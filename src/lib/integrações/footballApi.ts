import type { Jogo } from '@/types'
import { LIGAS_ACOMPANHADAS } from '@/lib/jogos'

const BASE_URL = 'https://v3.football.api-sports.io'

const LIGA_IDS = new Set<number>(LIGAS_ACOMPANHADAS.map((l) => l.id))

/** O plano free da API-Football só permite consultar `fixtures?date=` num intervalo rolante
 * curto (confirmado ao vivo: hoje ± 1 dia) — fora disso a API responde 200 OK com `response`
 * vazio e o motivo dentro de `errors.plan`, não um erro HTTP. Sem distinguir isso, vira um falso
 * "sem jogos" pra qualquer data fora da janela. */
export class PlanoRestritoError extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'PlanoRestritoError'
  }
}

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
  // `errors` pode vir como objeto ({ plan: "..." }) ou array, dependendo do tipo de erro — a API
  // sempre responde 200 OK mesmo quando bloqueia o request, então isso é a única forma de saber.
  // "plan" é a data fora da janela do plano free (permanente até a janela rolar) — qualquer outro
  // erro (ex: cota de 100 requests/dia estourada) é transitório e NÃO deve virar um "sem jogos"
  // cacheado; melhor deixar falhar e tentar de novo depois.
  const erros = json.errors
  const temErros = erros && (Array.isArray(erros) ? erros.length > 0 : Object.keys(erros).length > 0)
  if (temErros) {
    const erroPlano = !Array.isArray(erros) ? erros.plan : undefined
    if (erroPlano) throw new PlanoRestritoError(String(erroPlano))
    throw new Error(`API-Football error: ${JSON.stringify(erros)}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (json.response ?? []) as any[]

  return raw
    .filter((f) => LIGA_IDS.has(f.league?.id))
    .map(mapearFixture)
    .sort((a, b) => a.date.localeCompare(b.date))
}
