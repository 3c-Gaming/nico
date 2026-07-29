import { NextRequest, NextResponse } from 'next/server'
import { getOrFetch, invalidate } from '@/lib/cache'
import { listarNumeros } from '@/lib/integrações/sendpulse'
import { listarTags } from '@/lib/mcp/sendpulse'

const BASE_URL = 'https://uptntyjjfcbopcxflgnp.supabase.co/functions/v1/leads-export'
const EXPORT_KEY = '12ec6e8b105c396d3ab940adab51e516'
const TIMEOUT = 30_000
const TTL_TODAY = 60_000
const TTL_BOTS = 5 * 60_000
const TTL_TAGS_POR_BOT = 5 * 60_000

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

/**
 * Total (todo o período) direto da SendPulse — a fonte já mantém esse contador nativo por
 * tag (chatbots_bots_tags_list), então isso substitui o antigo contarTag(tag) sem data, que
 * baixava o histórico inteiro de leads da tag só pra contar o tamanho do array (bem mais lento
 * e sem limite, já que esse total só cresce). Busca a lista de tags de cada bot (cacheada) e
 * soma as contagens por nome de tag entre todos os bots.
 */
async function contarTagsSendpulseTotal(tags: string[]): Promise<Record<string, number>> {
  const bots = await getOrFetch('sendpulse-bots', 'all', TTL_BOTS, () => listarNumeros())
  const tagsPorBot = await Promise.all(
    bots.map((bot) =>
      getOrFetch('sendpulse-tags-por-bot', bot.id, TTL_TAGS_POR_BOT, () => listarTags(bot.id)).catch(() => []),
    ),
  )

  const totalPorNome = new Map<string, number>()
  for (const tagsDoBot of tagsPorBot) {
    for (const t of tagsDoBot) {
      totalPorNome.set(t.name, (totalPorNome.get(t.name) ?? 0) + t.contactCount)
    }
  }

  const resultado: Record<string, number> = {}
  for (const tag of tags) resultado[tag] = totalPorNome.get(tag) ?? 0
  return resultado
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
      }
      invalidate('sendpulse-tags-por-bot')
    }

    const hoje = body.data ?? hojeISO()
    const [totais, resultadosHoje] = await Promise.all([
      contarTagsSendpulseTotal(body.tags).catch(() => ({} as Record<string, number>)),
      Promise.allSettled(
        body.tags.map(async (tag) => {
          const hojeResult = await getOrFetch('leadhub-hoje-v2', tag, TTL_TODAY, () => contarTag(tag, hoje, hoje))
          return { tag, leads: hojeResult.count, ultimoLead: hojeResult.ultimoLeadAt }
        }),
      ),
    ])

    const leads: Record<string, number> = {}
    const ultimoLead: Record<string, string | null> = {}

    for (const r of resultadosHoje) {
      if (r.status === 'fulfilled') {
        leads[r.value.tag] = r.value.leads
        ultimoLead[r.value.tag] = r.value.ultimoLead
      }
    }

    return NextResponse.json({ leads, totais, ultimoLead })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
