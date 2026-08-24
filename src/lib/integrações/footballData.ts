// football-data.org — substitui o daxx-scrapping-bridge (SofaScore via Playwright, fora do ar)
// como fonte da tela de Jogos. Cobre só 4 das 7 competições acompanhadas (ver LIGAS_ACOMPANHADAS
// em @/lib/jogos): Brasileirão, Champions League, La Liga e Premier League estão no plano
// gratuito; Copa do Brasil, Libertadores e Sul-Americana não são cobertas (sem alternativa
// gratuita encontrada pra elas até agora — ficam sem jogos na tela por enquanto).

import type { Jogo } from '@/types'

const BASE_URL = 'https://api.football-data.org/v4'

// Mapeia o código da competição no football-data.org pro MESMO ligaId (numeração do
// API-Football) já usado no resto do app — em LIGAS_ACOMPANHADAS e no filtro de ligas — assim a
// troca de fonte de dados não exige mudar nada fora dessa camada de integração.
const LIGA_ID_POR_CODIGO: Record<string, number> = {
  BSA: 71, // Campeonato Brasileiro Série A
  CL: 2, // UEFA Champions League
  PD: 140, // La Liga (Primera División)
  PL: 39, // Premier League
}

function apiKey(): string {
  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) throw new Error('FOOTBALL_DATA_API_KEY não configurado')
  return key
}

const STATUS_MAP: Record<string, Jogo['status']> = {
  SCHEDULED: 'scheduled',
  TIMED: 'scheduled',
  IN_PLAY: 'live',
  PAUSED: 'live',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
  SUSPENDED: 'postponed',
  CANCELLED: 'cancelled',
  AWARDED: 'finished',
}

const STATUS_CURTO_MAP: Record<string, string> = {
  SCHEDULED: 'Agendado',
  TIMED: 'Agendado',
  IN_PLAY: 'Ao vivo',
  PAUSED: 'Intervalo',
  FINISHED: 'Encerrado',
  POSTPONED: 'Adiado',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
  AWARDED: 'Encerrado',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizar(match: any): Jogo | null {
  const ligaId = LIGA_ID_POR_CODIGO[match.competition?.code]
  if (!ligaId) return null
  return {
    id: match.id,
    ligaId,
    ligaNome: match.competition?.name ?? '',
    ligaLogo: match.competition?.emblem ?? undefined,
    paisNome: match.area?.name ?? undefined,
    rodada: match.matchday != null ? String(match.matchday) : undefined,
    date: match.utcDate,
    status: STATUS_MAP[match.status] ?? 'scheduled',
    statusCurto: STATUS_CURTO_MAP[match.status] ?? match.status,
    homeTeam: match.homeTeam?.name ?? '',
    awayTeam: match.awayTeam?.name ?? '',
    homeLogo: match.homeTeam?.crest ?? undefined,
    awayLogo: match.awayTeam?.crest ?? undefined,
    homeScore: match.score?.fullTime?.home ?? undefined,
    awayScore: match.score?.fullTime?.away ?? undefined,
  }
}

// O plano gratuito rejeita (HTTP 400) qualquer intervalo com mais de 10 dias de diferença entre
// dateFrom e dateTo — confirmado ao vivo (11 dias corridos passa, 12 já dá 400). O calendário da
// tela de Jogos mostra até 16 dias de uma vez, então um intervalo pedido maior que isso precisa
// ser dividido em pedaços de no máximo 10 dias de diferença cada.
const MAX_DIFF_DIAS = 10
const UM_DIA_MS = 24 * 60 * 60 * 1000

function paraDataUTC(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function paraISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dividirEmPartes(dataInicioISO: string, dataFimISO: string): [string, string][] {
  const partes: [string, string][] = []
  let cursor = paraDataUTC(dataInicioISO)
  const fim = paraDataUTC(dataFimISO)
  while (cursor <= fim) {
    const fimParte = new Date(Math.min(fim.getTime(), cursor.getTime() + MAX_DIFF_DIAS * UM_DIA_MS))
    partes.push([paraISO(cursor), paraISO(fimParte)])
    cursor = new Date(fimParte.getTime() + UM_DIA_MS)
  }
  return partes
}

async function buscarParte(dateFrom: string, dateTo: string, signal?: AbortSignal): Promise<Jogo[]> {
  const res = await fetch(`${BASE_URL}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { 'X-Auth-Token': apiKey() },
    signal,
  })
  if (!res.ok) throw new Error(`football-data.org: HTTP ${res.status}`)
  const json = await res.json()
  const matches = Array.isArray(json.matches) ? json.matches : []
  return matches.map(normalizar).filter((j: Jogo | null): j is Jogo => j !== null)
}

/** Busca jogos num intervalo de datas — divide em pedaços de no máximo 10 dias de diferença (ver
 * MAX_DIFF_DIAS) e busca em paralelo; o calendário da tela de Jogos mostra até 16 dias de uma
 * vez, então normalmente vira só 2 requests, bem abaixo do limite de 10 req/min do plano
 * gratuito. */
export async function buscarJogosPorIntervalo(dataInicioISO: string, dataFimISO: string, signal?: AbortSignal): Promise<Jogo[]> {
  const partes = dividirEmPartes(dataInicioISO, dataFimISO)
  const resultados = await Promise.all(partes.map(([de, ate]) => buscarParte(de, ate, signal)))
  return resultados.flat()
}
