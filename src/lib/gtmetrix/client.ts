import {
  GTMETRIX_API_KEY,
  GTMETRIX_LOCATION,
  GTMETRIX_BROWSER,
  GTMETRIX_DEVICE,
  GTMETRIX_THROTTLE,
  LIMITES,
  POLL_INTERVALO_MS,
  POLL_MAX_SEGUNDOS,
  PRECHECK_TIMEOUT_MS,
} from './config'
import type {
  GtmetrixCreditos,
  GtmetrixPreCheck,
  GtmetrixMetricas,
  GtmetrixPendente,
  GtmetrixFalha,
  GtmetrixConcluido,
} from './types'

const API = 'https://gtmetrix.com/api/2.0'

function auth(): string {
  return 'Basic ' + Buffer.from(`${GTMETRIX_API_KEY}:`).toString('base64')
}

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile Safari/604.1'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function gtHost(url: string): string {
  return String(url).replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

export function gtAgora(): string {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function gtFormatarMs(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'N/A'
  const n = Number(valor)
  if (isNaN(n)) return 'N/A'
  if (n >= 1000) return (n / 1000).toFixed(1) + 's'
  return Math.round(n) + 'ms'
}

/* ===================== CRÉDITOS ===================== */

export async function consultarCreditos(): Promise<GtmetrixCreditos | null> {
  try {
    const resp = await fetch(`${API}/status`, {
      headers: { Authorization: auth() },
      signal: AbortSignal.timeout(15_000),
    })
    if (resp.status === 401 || resp.status === 403) {
      return { creditos: 0, refill: 'N/A', erro: 'auth' }
    }
    if (!resp.ok) {
      return { creditos: 0, refill: 'N/A', erro: `http_${resp.status}` }
    }
    const json = await resp.json()
    const a = (json.data && json.data.attributes) || {}
    return {
      erro: null,
      creditos: Number(a.api_credits || 0),
      refill: a.api_refill
        ? new Date(a.api_refill * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : 'N/A',
    }
  } catch (e) {
    console.error('[gtmetrix] consultarCreditos:', (e as Error).message)
    return null
  }
}

/* ===================== PRÉ-CHECK (GRÁTIS) ===================== */
/* Bate na URL direto. Nada disso consome crédito GTmetrix. */

export async function preCheckIndividual(url: string): Promise<GtmetrixPreCheck> {
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA_IPHONE },
      signal: AbortSignal.timeout(PRECHECK_TIMEOUT_MS),
    })
    const corpo = await r.text().catch(() => '')
    const code = r.status
    return {
      url,
      ok: code > 0 && code <= LIMITES.http_ok_max && corpo.length > 200,
      status: code,
      motivo:
        code > LIMITES.http_ok_max
          ? `HTTP ${code}`
          : corpo.length <= 200
            ? 'Resposta vazia / página em branco'
            : '',
    }
  } catch (e) {
    return { url, ok: false, status: 0, motivo: `DNS/conexão falhou: ${(e as Error).message}` }
  }
}

export async function preCheckLote(urls: string[]): Promise<GtmetrixPreCheck[]> {
  return Promise.all(urls.map(preCheckIndividual))
}

/* ===================== GTMETRIX ===================== */

export async function iniciarTestesLote(urls: string[]): Promise<{
  pendentes: GtmetrixPendente[]
  falhas: GtmetrixFalha[]
}> {
  const pendentes: GtmetrixPendente[] = []
  const falhas: GtmetrixFalha[] = []

  await Promise.all(
    urls.map(async (url) => {
      try {
        const resp = await fetch(`${API}/tests`, {
          method: 'POST',
          headers: {
            Authorization: auth(),
            'Content-Type': 'application/vnd.api+json',
          },
          body: JSON.stringify({
            data: {
              type: 'test',
              attributes: {
                url,
                location: GTMETRIX_LOCATION,
                browser: GTMETRIX_BROWSER,
                simulate_device: GTMETRIX_DEVICE,
                throttle: GTMETRIX_THROTTLE,
                report: 'lighthouse',
              },
            },
          }),
          signal: AbortSignal.timeout(30_000),
        })
        const txt = await resp.text()
        let json: Record<string, unknown> = {}
        try {
          json = JSON.parse(txt)
        } catch {
          /* noop */
        }
        const data = json.data as { id?: string } | undefined
        if (data && data.id) {
          pendentes.push({ url, testId: data.id })
        } else {
          const errs = json.errors as { title?: string; detail?: string }[] | undefined
          const erro =
            (errs && errs[0] && (errs[0].title || errs[0].detail)) || `HTTP ${resp.status}`
          falhas.push({ url, motivo: `Não foi possível iniciar o teste (${erro})` })
        }
      } catch (e) {
        falhas.push({ url, motivo: `Falha ao iniciar o teste (${(e as Error).message})` })
      }
    }),
  )

  return { pendentes, falhas }
}

function extrairMetricas(reportId: string, attrs: Record<string, unknown>): GtmetrixMetricas {
  return {
    score: Number(attrs['performance_score'] || 0),
    gtmetrix: Number(attrs['gtmetrix_score'] || 0),
    grade: (attrs['gtmetrix_grade'] as string) || 'N/A',
    lcp_ms: Number(attrs['largest_contentful_paint'] || 0),
    tbt_ms: Number(attrs['total_blocking_time'] || 0),
    cls_num: Number(attrs['cumulative_layout_shift'] || 0),
    lcp: gtFormatarMs(attrs['largest_contentful_paint']),
    tbt: gtFormatarMs(attrs['total_blocking_time']),
    cls: Number(attrs['cumulative_layout_shift'] || 0).toFixed(3),
    speed_index: gtFormatarMs(attrs['speed_index']),
    load_time: gtFormatarMs(attrs['onload_time']),
    fcp: gtFormatarMs(attrs['first_contentful_paint']),
    ttfb: gtFormatarMs(attrs['time_to_first_byte']),
    report_url: `https://gtmetrix.com/reports/${reportId}/`,
  }
}

export async function aguardarLote(pendentes: GtmetrixPendente[]): Promise<{
  concluidos: GtmetrixConcluido[]
  erros: GtmetrixFalha[]
}> {
  const concluidos: GtmetrixConcluido[] = []
  const erros: GtmetrixFalha[] = []
  let restantes = pendentes.slice()
  const inicio = Date.now()

  while (restantes.length > 0 && Date.now() - inicio < POLL_MAX_SEGUNDOS * 1000) {
    await sleep(POLL_INTERVALO_MS)

    const aindaPendentes: GtmetrixPendente[] = []

    await Promise.all(
      restantes.map(async (p) => {
        let json: { data?: { id: string; type: string; attributes?: Record<string, unknown> } } = {}
        try {
          const resp = await fetch(`${API}/tests/${p.testId}`, {
            headers: { Authorization: auth() },
            redirect: 'follow',
            signal: AbortSignal.timeout(20_000),
          })
          json = await resp.json()
        } catch {
          aindaPendentes.push(p)
          return
        }

        if (!json.data) {
          aindaPendentes.push(p)
          return
        }

        const tipo = json.data.type
        const attrs = json.data.attributes || {}

        if (tipo === 'report') {
          concluidos.push({ url: p.url, dados: extrairMetricas(json.data.id, attrs) })
        } else if (attrs.state === 'error') {
          erros.push({
            url: p.url,
            motivo: `GTmetrix retornou erro: ${(attrs.error as string) || 'motivo não informado'}`,
          })
        } else {
          aindaPendentes.push(p)
        }
      }),
    )

    restantes = aindaPendentes
  }

  restantes.forEach((p) => {
    erros.push({ url: p.url, motivo: 'Timeout aguardando o relatório' })
  })

  return { concluidos, erros }
}

/* ===================== CLASSIFICAÇÃO ===================== */

export function avaliar(dados: GtmetrixMetricas): string[] {
  const problemas: string[] = []
  if (dados.score < LIMITES.performance_min)
    problemas.push(`Performance ${dados.score}/100 (min ${LIMITES.performance_min})`)
  if (dados.gtmetrix < LIMITES.gtmetrix_score_min)
    problemas.push(`GTmetrix Score ${dados.gtmetrix}/100 (min ${LIMITES.gtmetrix_score_min})`)
  if (dados.lcp_ms > LIMITES.lcp_max_ms)
    problemas.push(`LCP ${dados.lcp} (max ${gtFormatarMs(LIMITES.lcp_max_ms)})`)
  if (dados.tbt_ms > LIMITES.tbt_max_ms)
    problemas.push(`TBT ${dados.tbt} (max ${gtFormatarMs(LIMITES.tbt_max_ms)})`)
  if (dados.cls_num > LIMITES.cls_max)
    problemas.push(`CLS ${dados.cls} (max ${LIMITES.cls_max})`)
  return problemas
}
