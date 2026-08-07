import type { Jogo } from '@/types'
import { LIGAS_ACOMPANHADAS } from '@/lib/jogos'

const BASE_URL = 'https://v3.football.api-sports.io'

const LIGA_IDS = new Set<number>(LIGAS_ACOMPANHADAS.map((l) => l.id))

const STATUS_MAP: Record<string, Jogo['status']> = {
  TBD: 'scheduled',
  NS: 'scheduled',
  '1H': 'live',
  HT: 'live',
  '2H': 'live',
  ET: 'live',
  BT: 'live',
  P: 'live',
  SUSP: 'live',
  INT: 'live',
  LIVE: 'live',
  FT: 'finished',
  AET: 'finished',
  PEN: 'finished',
  AWD: 'finished',
  WO: 'finished',
  PST: 'postponed',
  CANC: 'cancelled',
  ABD: 'cancelled',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearFixture(f: any): Jogo {
  const statusCurto = String(f.fixture?.status?.short ?? '')
  return {
    id: f.fixture.id,
    ligaId: f.league.id,
    ligaNome: f.league.name,
    ligaLogo: f.league.logo,
    paisNome: f.league.country,
    rodada: f.league.round,
    date: f.fixture.date,
    statusCurto,
    status: STATUS_MAP[statusCurto] ?? 'scheduled',
    elapsed: f.fixture.status?.elapsed ?? null,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    homeScore: f.goals.home ?? undefined,
    awayScore: f.goals.away ?? undefined,
    venue: f.fixture.venue?.name,
    city: f.fixture.venue?.city,
  }
}

/**
 * Busca TODOS os jogos do mundo numa data (um único request — a API não deixa filtrar por
 * várias ligas de uma vez sem gastar um request por liga) e filtra localmente pras ligas que
 * acompanhamos. É a forma mais barata de cobrir 7 campeonatos: 1 request por dia em vez de 7.
 */
export async function buscarJogosPorData(dataISO: string, signal?: AbortSignal): Promise<Jogo[]> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_API_KEY não configurada')

  const res = await fetch(`${BASE_URL}/fixtures?date=${dataISO}`, {
    headers: { 'x-apisports-key': apiKey },
    signal,
  })
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`)

  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (json.response ?? []) as any[]

  return raw
    .filter((f) => LIGA_IDS.has(f.league?.id))
    .map(mapearFixture)
    .sort((a, b) => a.date.localeCompare(b.date))
}
