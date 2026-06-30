import { NextRequest, NextResponse } from 'next/server'
import type { CopaMatch } from '@/types'

const BASE = 'https://www.thesportsdb.com/api/v1/json/123'
const LEAGUE_ID = '4429'

const STAGE_MAP: Record<string, string> = {
  '1': 'Group Stage',
  '32': 'Round of 32',
  '16': 'Round of 16',
  '8': 'Quarter-final',
  '4': 'Semi-final',
  '2': 'Final',
}

const STATUS_MAP: Record<string, string> = {
  'NS': 'scheduled',
  'FT': 'finished',
}

let cache: { data: CopaMatch[]; date: string; expiresAt: number } | null = null

function mapearStage(event: Record<string, unknown>): string {
  const round = String(event.intRound ?? '')
  const base = STAGE_MAP[round] ?? `Round ${round}`
  if (round === '1' && event.strGroup) {
    return `${base} (${event.strGroup})`
  }
  return base
}

function mapearStatus(strStatus: unknown): string {
  return STATUS_MAP[String(strStatus)] ?? String(strStatus).toLowerCase()
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  if (!date) {
    return NextResponse.json({ error: 'Parâmetro "date" obrigatório (YYYY-MM-DD)' }, { status: 400 })
  }

  if (cache && cache.date === date && cache.expiresAt > Date.now()) {
    return NextResponse.json({ matches: cache.data })
  }

  try {
    const url = `${BASE}/eventsday.php?d=${date}&l=${LEAGUE_ID}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `TheSportsDB HTTP ${res.status}: ${text}` }, { status: 502 })
    }

    const json = await res.json()
    const rawEvents: Record<string, unknown>[] = Array.isArray(json.events) ? json.events : []

    const matches: CopaMatch[] = rawEvents.map((e) => ({
      id: Number(e.idEvent),
      homeTeam: String(e.strHomeTeam ?? ''),
      awayTeam: String(e.strAwayTeam ?? ''),
      homeLogo: e.strHomeTeamBadge ? String(e.strHomeTeamBadge) : undefined,
      awayLogo: e.strAwayTeamBadge ? String(e.strAwayTeamBadge) : undefined,
      date: String(e.strTimestamp ?? ''),
      stage: mapearStage(e),
      status: mapearStatus(e.strStatus),
      venue: e.strVenue ? String(e.strVenue) : undefined,
      country: e.strCountry ? String(e.strCountry) : undefined,
      city: e.strCity ? String(e.strCity) : undefined,
      group: e.strGroup ? String(e.strGroup) : undefined,
      homeScore: e.intHomeScore != null ? Number(e.intHomeScore) : undefined,
      awayScore: e.intAwayScore != null ? Number(e.intAwayScore) : undefined,
    }))

    cache = { data: matches, date, expiresAt: Date.now() + 5 * 60 * 1000 }

    return NextResponse.json({ matches })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
