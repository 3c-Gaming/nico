import { NextRequest, NextResponse } from 'next/server'
import { listarTagsSendpulse, resolverContaEBotTelegram } from '@/lib/integrações/sendpulse'

/** GET /api/telegram/tags?botIdentificador=... — lista as tags conhecidas desse bot na SendPulse
 * (com quantos contatos cada uma tem), pra montar um disparo direto de uma tag em vez de CSV. */
export async function GET(request: NextRequest) {
  const botIdentificador = request.nextUrl.searchParams.get('botIdentificador')
  if (!botIdentificador) return NextResponse.json({ error: 'botIdentificador obrigatório' }, { status: 400 })

  const conta = await resolverContaEBotTelegram(botIdentificador)
  if (!conta) return NextResponse.json({ error: `Bot "${botIdentificador}" não encontrado em nenhuma conta SendPulse configurada` }, { status: 404 })

  try {
    const tags = await listarTagsSendpulse(conta.botId, conta.apiKey, 'telegram')
    return NextResponse.json({ tags })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
