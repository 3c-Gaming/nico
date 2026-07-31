import { NextRequest, NextResponse } from 'next/server'
import { listarFluxos } from '@/lib/integrações/sendpulse'
import { comContaDoBot } from '@/lib/integrações/contasSendpulse'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 5 * 60_000

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')
  if (!botId) {
    return NextResponse.json({ error: 'bot_id é obrigatório' }, { status: 400 })
  }

  try {
    const data = await getOrFetch('fluxos', botId, TTL_MS, () =>
      comContaDoBot(botId, (apiKey) => listarFluxos(botId, apiKey))
    )
    return NextResponse.json({ fluxos: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
