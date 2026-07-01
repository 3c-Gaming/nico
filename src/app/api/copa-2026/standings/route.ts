import { NextResponse } from 'next/server'
import type { GroupStanding } from '@/types'

const BASE = 'https://www.thesportsdb.com/api/v1/json/123'
const LEAGUE_ID = '4429'

interface CacheEntry {
  data: GroupStanding[]
  expiresAt: number
}
let cache: CacheEntry | null = null

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ standings: cache.data })
  }

  try {
    const res = await fetch(`${BASE}/lookuptable.php?l=${LEAGUE_ID}`, {
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 })
    }

    const json = await res.json()
    const raw: Record<string, unknown>[] = Array.isArray(json.table) ? json.table : []

    const standings: GroupStanding[] = raw.map((t) => ({
      rank: Number(t.intRank),
      teamId: String(t.idTeam),
      teamName: String(t.strTeam),
      badge: String(t.strBadge ?? ''),
      group: String(t.strGroup ?? ''),
      played: Number(t.intPlayed),
      win: Number(t.intWin),
      draw: Number(t.intDraw),
      loss: Number(t.intLoss),
      goalsFor: Number(t.intGoalsFor),
      goalsAgainst: Number(t.intGoalsAgainst),
      goalDifference: Number(t.intGoalDifference),
      points: Number(t.intPoints),
      form: String(t.strForm ?? ''),
    }))

    cache = { data: standings, expiresAt: Date.now() + 5 * 60 * 1000 }

    return NextResponse.json({ standings })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
