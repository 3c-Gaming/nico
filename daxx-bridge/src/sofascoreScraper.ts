import type { BrowserContext, Page } from 'playwright'
import { getBrowser } from './scraper.js'

const SOFASCORE_URL = 'https://www.sofascore.com/pt/football'

// Ids de "unique tournament" do SofaScore pras 7 ligas que acompanhamos — não são os mesmos ids
// do API-Football. Descobertos via a busca do próprio site (search/all) e confirmados ao vivo
// comparando os jogos retornados (nomes de times reais, rodada) contra o que já sabíamos ser
// verdade (ex: Copa do Brasil batendo com os confrontos de quartas de final reais).
const LIGAS_SOFASCORE: Record<number, string> = {
  325: 'Brasileirão Série A',
  373: 'Copa do Brasil',
  384: 'Libertadores',
  480: 'Sul-Americana',
  7: 'UEFA Champions League',
  8: 'La Liga',
  17: 'Premier League',
}

export interface Jogo {
  id: number
  ligaId: number
  ligaNome: string
  ligaLogo?: string
  paisNome?: string
  rodada?: string
  date: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
  statusCurto: string
  elapsed?: number | null
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
  homeScore?: number
  awayScore?: number
  venue?: string
  city?: string
}

const STATUS_MAP: Record<string, Jogo['status']> = {
  notstarted: 'scheduled',
  delayed: 'scheduled',
  inprogress: 'live',
  interrupted: 'live',
  suspended: 'live',
  finished: 'finished',
  postponed: 'postponed',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  abandoned: 'cancelled',
}

let context: BrowserContext | null = null
let page: Page | null = null
let lastNav = 0
const SESSION_TTL = 30 * 60 * 1000
let sessaoPromise: Promise<Page> | null = null

// Serializa as buscas — disparar várias datas em paralelo significa dezenas de page.evaluate()
// concorrentes na mesma página compartilhada, e isso derrubou a instância no Render (reinício
// por instância, respostas vazias no meio de uma rajada de requests). Uma data de cada vez é bem
// mais lento por request, mas não derruba o serviço.
let filaSofascore: Promise<unknown> = Promise.resolve()

function comFila<T>(fn: () => Promise<T>): Promise<T> {
  const proxima = filaSofascore.then(fn, fn)
  filaSofascore = proxima.then(() => {}, () => {})
  return proxima
}

/** Sem login (dados públicos) — só precisa de uma sessão de navegador de verdade (cookies +
 * fingerprint TLS do Chrome) pra passar pela proteção anti-bot. Confirmado ao vivo: chamar a API
 * direto de fora de um navegador (curl, headers de navegador falsos) dá 403; a mesma chamada
 * feita de dentro de uma página do sofascore.com (mesma origem) funciona normal. */
async function ensurePage(): Promise<Page> {
  if (sessaoPromise) return sessaoPromise

  sessaoPromise = (async () => {
    if (page && Date.now() - lastNav < SESSION_TTL) {
      try {
        await page.evaluate(() => document.title)
        return page
      } catch {
        console.log('[sofascore] page lost, reconnecting')
      }
    }

    if (context) {
      try { await context.close() } catch {}
    }

    const b = await getBrowser()
    context = await b.newContext()
    page = await context.newPage()
    await page.goto(SOFASCORE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    lastNav = Date.now()
    const titulo = await page.title().catch(() => '')
    const url = page.url()
    console.log(`[sofascore] session ready — url=${url} title="${titulo}"`)
    return page
  })()

  try {
    return await sessaoPromise
  } finally {
    sessaoPromise = null
  }
}

// page.evaluate recebe uma STRING aqui, não uma função — mesmo motivo documentado em
// h2premiosScraper.ts (esbuild injeta um helper __name que não existe no browser).
function buscarJogosLigaJs(ligaId: number, dataISO: string): string {
  return `
(async function () {
  var res = await fetch('https://www.sofascore.com/api/v1/unique-tournament/${ligaId}/scheduled-events/${dataISO}');
  if (!res.ok) return { ok: false, status: res.status };
  var json = await res.json();
  return { ok: true, events: json.events || [] };
})()
`
}

/** Brasil não tem horário de verão desde 2019 — sempre UTC-3 fixo, dá pra calcular sem depender
 * de timezone database (mesmo truque documentado em src/lib/datas.ts do app principal). */
function dataBrasilISO(startTimestamp: number): string {
  return new Date(startTimestamp * 1000 - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function diaSeguinte(dataISO: string, offset: number): string {
  const d = new Date(`${dataISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearEvento(e: any, ligaId: number): Jogo {
  const statusType = String(e.status?.type ?? '')
  return {
    id: e.id,
    ligaId,
    ligaNome: e.tournament?.name ?? LIGAS_SOFASCORE[ligaId] ?? '',
    ligaLogo: `https://img.sofascore.com/api/v1/unique-tournament/${ligaId}/image`,
    paisNome: e.tournament?.category?.name,
    rodada: e.roundInfo?.round != null ? String(e.roundInfo.round) : undefined,
    date: new Date((e.startTimestamp ?? 0) * 1000).toISOString(),
    status: STATUS_MAP[statusType] ?? 'scheduled',
    statusCurto: e.status?.description ?? statusType,
    elapsed: null,
    homeTeam: e.homeTeam?.name ?? '',
    awayTeam: e.awayTeam?.name ?? '',
    homeLogo: e.homeTeam?.id ? `https://img.sofascore.com/api/v1/team/${e.homeTeam.id}/image` : undefined,
    awayLogo: e.awayTeam?.id ? `https://img.sofascore.com/api/v1/team/${e.awayTeam.id}/image` : undefined,
    homeScore: typeof e.homeScore?.current === 'number' ? e.homeScore.current : undefined,
    awayScore: typeof e.awayScore?.current === 'number' ? e.awayScore.current : undefined,
    venue: e.venue?.stadium?.name ?? e.venue?.name,
    city: e.venue?.city?.name,
  }
}

/**
 * Busca os jogos das 7 ligas acompanhadas numa data — sem restrição de janela de dias (ao
 * contrário do API-Football free), confirmado ao vivo pra datas bem além de hoje±1.
 *
 * O endpoint `scheduled-events/{data}` do SofaScore não é confiável pra "jogos exatamente nesse
 * dia": confirmado ao vivo que consultar um dia sem rodada própria pode devolver a rodada do dia
 * anterior de novo (ex: pedir 12/08 devolve os mesmos jogos de 11/08). Por isso consultamos
 * dia-1/dia/dia+1 de cada liga e filtramos pelo `startTimestamp` real de cada jogo (convertido
 * pro fuso de Brasília) — só entra o que realmente é desse dia, não o que a API decidiu bucketizar
 * nele.
 */
export async function buscarJogosPorData(dataISO: string): Promise<Jogo[]> {
  return comFila(async () => {
    const p = await ensurePage()
    const ligaIds = Object.keys(LIGAS_SOFASCORE).map(Number)
    const datasJanela = [diaSeguinte(dataISO, -1), dataISO, diaSeguinte(dataISO, 1)]

    // Sequencial por liga (não Promise.all) — de propósito, pra não empilhar 21 evaluates
    // concorrentes na mesma página numa instância pequena.
    const todosJogos: Jogo[] = []
    for (const ligaId of ligaIds) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventosPorId = new Map<number, any>()
        for (const d of datasJanela) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = await p.evaluate<any>(buscarJogosLigaJs(ligaId, d))
          if (!r.ok) continue
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const e of r.events as any[]) eventosPorId.set(e.id, e)
        }
        const jogosDaLiga = [...eventosPorId.values()]
          .filter((e) => dataBrasilISO(e.startTimestamp ?? 0) === dataISO)
          .map((e) => mapearEvento(e, ligaId))
        todosJogos.push(...jogosDaLiga)
      } catch (err) {
        console.error(`[sofascore] erro liga ${ligaId}:`, (err as Error).message)
      }
    }

    return todosJogos.sort((a, b) => a.date.localeCompare(b.date))
  })
}

export async function closeSofascore(): Promise<void> {
  if (context) {
    try { await context.close() } catch {}
  }
  context = null
  page = null
}
