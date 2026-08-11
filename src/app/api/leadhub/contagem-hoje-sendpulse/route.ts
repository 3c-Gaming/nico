import { NextRequest, NextResponse } from 'next/server'
import { getOrFetch, invalidate } from '@/lib/cache'
import { comContaDoBot } from '@/lib/integrações/contasSendpulse'
import { contarPorTagHojeSendpulse } from '@/lib/integrações/sendpulse'

const TTL_HOJE = 60_000

/**
 * POST /api/leadhub/contagem-hoje-sendpulse
 * body: { botId: string; tags: string[]; refresh?: boolean }
 *
 * Contagem de leads de HOJE, direto na API da SendPulse (getByTag) — sem paginar, já que "hoje"
 * está sempre no topo da lista (ordenada do mais recente pro mais antigo). Pra um intervalo de
 * mais de um dia, use /api/sendpulse/contagem-intervalo.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { botId: string; tags: string[]; refresh?: boolean }
    if (!body.botId || !body.tags || !Array.isArray(body.tags) || body.tags.length === 0) {
      return NextResponse.json({ error: 'botId e tags são obrigatórios' }, { status: 400 })
    }

    if (body.refresh) {
      for (const tag of body.tags) invalidate('sendpulse-tag-hoje', `${body.botId}:${tag}`)
    }

    const leads: Record<string, number> = {}
    const totais: Record<string, number> = {}
    const ultimoLead: Record<string, string | null> = {}

    await Promise.allSettled(
      body.tags.map(async (tag) => {
        const resultado = await getOrFetch(
          'sendpulse-tag-hoje',
          `${body.botId}:${tag}`,
          TTL_HOJE,
          () => comContaDoBot(body.botId, (apiKey) =>
            contarPorTagHojeSendpulse(body.botId, tag, apiKey, AbortSignal.timeout(15_000)),
          ),
        )
        leads[tag] = resultado.hoje
        totais[tag] = resultado.total
        ultimoLead[tag] = resultado.ultimoLeadAt
      }),
    )

    return NextResponse.json({ leads, totais, ultimoLead })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
