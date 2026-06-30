import { NextRequest, NextResponse } from 'next/server'
import { getOrFetch, invalidate } from '@/lib/cache'

const BASE_URL = 'https://uptntyjjfcbopcxflgnp.supabase.co/functions/v1/leads-export'
const EXPORT_KEY = '12ec6e8b105c396d3ab940adab51e516'
const TIMEOUT = 30_000
const TTL_TODAY = 60_000
const TTL_TOTAL = 5 * 60_000

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function extrairTimestampLead(lead: Record<string, unknown>): string | null {
  for (const campo of ['criado_em', 'atualizado_em', 'created_at', 'createdAt', 'created']) {
    const val = lead[campo]
    if (typeof val === 'string' && val) return val
  }
  return null
}

async function contarTag(
  tag: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ count: number; ultimoLeadAt: string | null }> {
  const params = new URLSearchParams({
    project_id: '01',
    filter_tag: tag,
    limit: 'all',
  })
  if (dateFrom) params.set('filter_date_from', dateFrom)
  if (dateTo) params.set('filter_date_to', dateTo)

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { 'x-export-key': EXPORT_KEY },
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`LeadHub error for tag ${tag}: ${res.status}${text ? ` — ${text}` : ''}`)
    return { count: 0, ultimoLeadAt: null }
  }

  const json = await res.json()
  const leads = (json.leads ?? []) as Record<string, unknown>[]
  let ultimoLeadAt: string | null = null
  for (const lead of leads) {
    const ts = extrairTimestampLead(lead)
    if (ts && (!ultimoLeadAt || ts > ultimoLeadAt)) {
      ultimoLeadAt = ts
    }
  }
  return { count: leads.length, ultimoLeadAt }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { tags: string[]; data?: string; refresh?: boolean }
    if (!body.tags || !Array.isArray(body.tags) || body.tags.length === 0) {
      return NextResponse.json({ error: 'tags é obrigatório' }, { status: 400 })
    }

    if (body.refresh) {
      for (const tag of body.tags) {
        invalidate('leadhub-hoje-v2', tag)
        invalidate('leadhub-total-v2', tag)
      }
    }

    const hoje = body.data ?? hojeISO()
    const resultados = await Promise.allSettled(
      body.tags.map(async (tag) => {
        const [hojeResult, totalResult] = await Promise.all([
          getOrFetch('leadhub-hoje-v2', tag, TTL_TODAY, () => contarTag(tag, hoje, hoje)),
          getOrFetch('leadhub-total-v2', tag, TTL_TOTAL, () => contarTag(tag)),
        ])
        return { tag, leads: hojeResult.count, total: totalResult.count, ultimoLead: hojeResult.ultimoLeadAt }
      })
    )

    const leads: Record<string, number> = {}
    const totais: Record<string, number> = {}
    const ultimoLead: Record<string, string | null> = {}

    for (const r of resultados) {
      if (r.status === 'fulfilled') {
        leads[r.value.tag] = r.value.leads
        totais[r.value.tag] = r.value.total
        ultimoLead[r.value.tag] = r.value.ultimoLead
      }
    }

    return NextResponse.json({ leads, totais, ultimoLead })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
