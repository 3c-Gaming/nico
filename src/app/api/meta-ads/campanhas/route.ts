import { NextRequest, NextResponse } from 'next/server'

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

// Nome de campanha do Meta não segue um padrão confiável pra achar sozinho qual funil é (ex:
// "F01"/"F01.02" aparece tanto no funil F01.11 quanto num produto completamente diferente) — por
// isso essa rota só busca/normaliza os dados, sem tentar casar com funil nenhum; a atribuição é
// manual, feita no painel de Detalhes (ver FlowTagConfig.campanhasMeta).
export async function GET(request: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: 'EXPORT_API_KEY não configurada' }, { status: 500 })

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from e to são obrigatórios (YYYY-MM-DD)' }, { status: 400 })

  const url = `${API_BASE}/export/meta-ads?key=${API_KEY}&project=${PROJECT}&from=${from}&to=${to}`

  try {
    // Serviço externo (Railway) já se mostrou instável sob requisições concorrentes — uma
    // tentativa extra antes de desistir evita mostrar erro por causa de um 502 passageiro.
    let res: Response | null = null
    let ultimoErro = ''
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      if (tentativa > 0) await new Promise((r) => setTimeout(r, 500))
      res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (res.ok) break
      ultimoErro = `Meta ads export error ${res.status}: ${await res.text().catch(() => '')}`
      res = null
    }
    if (!res) return NextResponse.json({ error: ultimoErro }, { status: 502 })
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const campanhas: CampanhaMeta[] = ((json.data ?? []) as any[]).map((item) => ({
      data: String(item.date ?? ''),
      nome: String(item.campaign_name ?? ''),
      gasto: Number(item.amount_spent ?? 0),
      impressoes: Number(item.impressions ?? 0),
      pageViews: Number(item.page_views ?? 0),
      cliquesLink: Number(item.link_clicks ?? 0),
    }))
    return NextResponse.json({ from, to, campanhas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
