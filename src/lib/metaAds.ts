// Cliente do export de campanhas do Meta Ads — extraído de
// src/app/api/meta-ads/campanhas/route.ts pra poder ser chamado direto de código server-side que
// não pode usar fetch relativo (crons, snapshot diário de funil).

const API_BASE = 'https://3cgg-extraction-system.up.railway.app'
const API_KEY = process.env.EXPORT_API_KEY
const PROJECT = 'pilhado'

export interface CampanhaMeta {
  data: string
  nome: string
  gasto: number
  impressoes: number
  pageViews: number
  cliquesLink: number
}

/** Campanhas do Meta Ads (gasto/impressões/etc) no período — não tenta casar com funil nenhum
 * (nome de campanha não segue padrão confiável), isso é feito por quem chama via
 * FlowTagConfig.campanhasMeta (atribuição manual). Lança se a key não estiver configurada ou se
 * as duas tentativas contra o serviço (instável sob concorrência) falharem. */
export async function buscarCampanhasMeta(from: string, to: string): Promise<CampanhaMeta[]> {
  if (!API_KEY) throw new Error('EXPORT_API_KEY não configurada')
  const url = `${API_BASE}/export/meta-ads?key=${API_KEY}&project=${PROJECT}&from=${from}&to=${to}`

  let res: Response | null = null
  let ultimoErro = ''
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    if (tentativa > 0) await new Promise((r) => setTimeout(r, 500))
    res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (res.ok) break
    ultimoErro = `Meta ads export error ${res.status}: ${await res.text().catch(() => '')}`
    res = null
  }
  if (!res) throw new Error(ultimoErro)
  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((json.data ?? []) as any[]).map((item) => ({
    data: String(item.date ?? ''),
    nome: String(item.campaign_name ?? ''),
    gasto: Number(item.amount_spent ?? 0),
    impressoes: Number(item.impressions ?? 0),
    pageViews: Number(item.page_views ?? 0),
    cliquesLink: Number(item.link_clicks ?? 0),
  }))
}
