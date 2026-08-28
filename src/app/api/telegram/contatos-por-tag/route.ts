import { NextRequest, NextResponse } from 'next/server'
import { buscarContatosCompletosPorTag, resolverContaEBotTelegram } from '@/lib/integrações/sendpulse'

/** GET /api/telegram/contatos-por-tag?botIdentificador=...&tag=... — todos os contatos dessa tag,
 * já com telegram_id — usado pra montar a base de um disparo direto da SendPulse, sem CSV. */
export async function GET(request: NextRequest) {
  const botIdentificador = request.nextUrl.searchParams.get('botIdentificador')
  const tag = request.nextUrl.searchParams.get('tag')
  if (!botIdentificador || !tag) return NextResponse.json({ error: 'botIdentificador e tag são obrigatórios' }, { status: 400 })

  const conta = await resolverContaEBotTelegram(botIdentificador)
  if (!conta) return NextResponse.json({ error: `Bot "${botIdentificador}" não encontrado em nenhuma conta SendPulse configurada` }, { status: 404 })

  try {
    const contatos = await buscarContatosCompletosPorTag(conta.botId, tag, conta.apiKey, 'telegram')
    const comTelegramId = contatos.filter((c) => c.telegramId != null)
    return NextResponse.json({
      total: contatos.length,
      disponiveis: comTelegramId.length,
      contatos: comTelegramId.map((c) => ({ username: c.username, telegramId: c.telegramId, nome: c.nome })),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
