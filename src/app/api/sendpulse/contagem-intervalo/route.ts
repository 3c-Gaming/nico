import { NextRequest, NextResponse } from 'next/server'
import { getOrFetch, invalidate } from '@/lib/cache'
import { comContaECanalDoBot } from '@/lib/integrações/contasSendpulse'
import { contarPorTagIntervaloSendpulse } from '@/lib/integrações/sendpulse'

const TTL = 60_000

// Pior caso (intervalo antigo numa tag de muito volume) pode precisar paginar bastante — folga
// acima do padrão da Vercel pra não matar a função no meio de uma busca ainda válida.
export const maxDuration = 200

/**
 * POST /api/sendpulse/contagem-intervalo
 * body: { botId: string; tags: string[]; dataInicio: string; dataFim: string; refresh?: boolean }
 *
 * Contagem de leads por tag num intervalo de datas — direto na API da SendPulse (getByTag,
 * paginado), sem depender do LeadHub (função externa lenta, ~60-70s fixos por chamada,
 * descontinuada por causa disso). Pra "hoje" (dataInicio === dataFim === hoje), use
 * /api/leadhub/contagem-hoje-sendpulse, que já cobre esse caso sem paginar.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { botId: string; tags: string[]; dataInicio: string; dataFim: string; refresh?: boolean }
    if (!body.botId || !body.tags || !Array.isArray(body.tags) || body.tags.length === 0 || !body.dataInicio || !body.dataFim) {
      return NextResponse.json({ error: 'botId, tags, dataInicio e dataFim são obrigatórios' }, { status: 400 })
    }

    if (body.refresh) {
      for (const tag of body.tags) {
        invalidate('sendpulse-tag-intervalo', `${body.botId}:${tag}:${body.dataInicio}:${body.dataFim}`)
      }
    }

    const leads: Record<string, number> = {}
    const ultimoLead: Record<string, string | null> = {}

    await Promise.allSettled(
      body.tags.map(async (tag) => {
        const resultado = await getOrFetch(
          'sendpulse-tag-intervalo',
          `${body.botId}:${tag}:${body.dataInicio}:${body.dataFim}`,
          TTL,
          () => comContaECanalDoBot(body.botId, (apiKey, canal) =>
            contarPorTagIntervaloSendpulse(body.botId, tag, apiKey, body.dataInicio, body.dataFim, AbortSignal.timeout(60_000), canal),
          ),
        )
        leads[tag] = resultado.total
        ultimoLead[tag] = resultado.ultimoLeadAt
      }),
    )

    return NextResponse.json({ leads, ultimoLead })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
