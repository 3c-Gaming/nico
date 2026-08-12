import { NextRequest, NextResponse } from 'next/server'
import { getOrFetch, invalidate } from '@/lib/cache'
import { dataParaBrasilISO } from '@/lib/datas'

const BASE_URL = 'https://uptntyjjfcbopcxflgnp.supabase.co/functions/v1/leads-export'
const EXPORT_KEY = process.env.LEADHUB_EXPORT_KEY ?? '12ec6e8b105c396d3ab940adab51e516'
const TIMEOUT = 20_000
const TTL = 5 * 60_000

function extrairTimestampLead(lead: Record<string, unknown>): string | null {
  for (const campo of ['criado_em', 'atualizado_em', 'created_at', 'createdAt', 'created']) {
    const val = lead[campo]
    if (typeof val === 'string' && val) return val
  }
  return null
}

/**
 * Uma chamada por tag pro range inteiro (LeadHub aceita filter_date_from/filter_date_to) — não
 * uma por dia. Cada lead vem com seu próprio timestamp, então o balde por dia é feito aqui.
 */
async function buscarLeadsPorDia(tag: string, dataInicio: string, dataFim: string): Promise<Record<string, number>> {
  const params = new URLSearchParams({
    project_id: '01',
    filter_tag: tag,
    limit: 'all',
    filter_date_from: dataInicio,
    filter_date_to: dataFim,
  })
  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { 'x-export-key': EXPORT_KEY },
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) {
    console.error(`LeadHub error for tag ${tag}: ${res.status}`)
    return {}
  }
  const json = await res.json()
  const leads = (json.leads ?? []) as Record<string, unknown>[]
  const porDia: Record<string, number> = {}
  for (const lead of leads) {
    const ts = extrairTimestampLead(lead)
    if (!ts) continue
    const dia = dataParaBrasilISO(ts)
    porDia[dia] = (porDia[dia] ?? 0) + 1
  }
  return porDia
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { tag: string; dataInicio: string; dataFim: string; refresh?: boolean }
    if (!body.tag || !body.dataInicio || !body.dataFim) {
      return NextResponse.json({ error: 'tag, dataInicio e dataFim são obrigatórios' }, { status: 400 })
    }

    const chave = `${body.tag}:${body.dataInicio}:${body.dataFim}`
    if (body.refresh) invalidate('leadhub-por-dia', chave)

    const porDia = await getOrFetch('leadhub-por-dia', chave, TTL, () =>
      buscarLeadsPorDia(body.tag, body.dataInicio, body.dataFim),
    )
    return NextResponse.json({ porDia })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
