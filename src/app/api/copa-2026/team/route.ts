import { NextRequest, NextResponse } from 'next/server'
import type { TeamInfo, RecentMatch } from '@/types'

const BASE = 'https://www.thesportsdb.com/api/v1/json/123'
const LEAGUE_ID = '4429'

interface CacheEntry {
  data: { info: TeamInfo; recent: RecentMatch[] }
  key: string
  expiresAt: number
}
let cache: CacheEntry | null = null

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')
  if (!name) {
    return NextResponse.json({ error: 'Parâmetro "name" obrigatório' }, { status: 400 })
  }

  const cacheKey = name.toLowerCase().trim()
  if (cache && cache.key === cacheKey && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data)
  }

  try {
    const searchRes = await fetch(`${BASE}/searchteams.php?t=${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(15_000),
    })

    if (!searchRes.ok) {
      return NextResponse.json({ error: `TheSportsDB HTTP ${searchRes.status}` }, { status: 502 })
    }

    const searchJson = await searchRes.json()
    const teamRaw: Record<string, unknown> | undefined = Array.isArray(searchJson.teams) ? searchJson.teams[0] : undefined

    if (!teamRaw) {
      return NextResponse.json({ error: `Time "${name}" não encontrado` }, { status: 404 })
    }

    const info: TeamInfo = {
      id: String(teamRaw.idTeam),
      name: String(teamRaw.strTeam),
      shortName: String(teamRaw.strTeamShort ?? ''),
      badge: String(teamRaw.strBadge ?? ''),
      stadium: String(teamRaw.strStadium ?? ''),
      location: String(teamRaw.strLocation ?? ''),
      capacity: Number(teamRaw.intStadiumCapacity ?? 0),
      description: String(teamRaw.strDescriptionEN ?? '').slice(0, 500),
      formedYear: String(teamRaw.intFormedYear ?? ''),
    }

    const recentRes = await fetch(`${BASE}/eventslast.php?id=${info.id}`, {
      signal: AbortSignal.timeout(15_000),
    })

    let recent: RecentMatch[] = []
    if (recentRes.ok) {
      const recentJson = await recentRes.json()
      const rawEvents: Record<string, unknown>[] = Array.isArray(recentJson.results) ? recentJson.results : []
      recent = rawEvents
        .filter((e) => String(e.idLeague) === LEAGUE_ID)
        .slice(0, 5)
        .map((e) => ({
          id: String(e.idEvent),
          date: String(e.dateEvent ?? ''),
          homeTeam: String(e.strHomeTeam ?? ''),
          awayTeam: String(e.strAwayTeam ?? ''),
          homeScore: e.intHomeScore != null ? Number(e.intHomeScore) : null,
          awayScore: e.intAwayScore != null ? Number(e.intAwayScore) : null,
          round: String(e.intRound ?? ''),
          league: String(e.strLeague ?? ''),
          status: String(e.strStatus ?? ''),
        }))
    }

    const data = { info, recent }
    cache = { data, key: cacheKey, expiresAt: Date.now() + 5 * 60 * 1000 }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
