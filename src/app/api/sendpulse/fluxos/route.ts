import { NextRequest, NextResponse } from 'next/server'
import { listarFluxos } from '@/lib/integrações/sendpulse'
import { comContaECanalDoBot } from '@/lib/integrações/contasSendpulse'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 5 * 60_000

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')
  if (!botId) {
    return NextResponse.json({ error: 'bot_id é obrigatório' }, { status: 400 })
  }

  try {
    // Resolve conta E canal (whatsapp/telegram) sozinho — sem precisar de um ?canal= aqui, então
    // todo call site existente (Disparos, Discord, etc.) continua funcionando sem mudança, e bots
    // de Telegram passam a resolver também.
    const data = await getOrFetch('fluxos', botId, TTL_MS, () =>
      comContaECanalDoBot(botId, (apiKey, canal) => listarFluxos(botId, apiKey, undefined, canal))
    )
    return NextResponse.json({ fluxos: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
