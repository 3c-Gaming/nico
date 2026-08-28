import { NextRequest, NextResponse } from 'next/server'
import { buscarIndiceContatosPorUsername } from '@/lib/integrações/telegram'
import { resolverContaEBotTelegram } from '@/lib/integrações/sendpulse'

interface ResolverBody {
  botIdentificador: string
  usernames: string[]
}

function normalizarUsername(valor: string): string {
  return valor.trim().replace(/^@/, '').toLowerCase()
}

/** POST /api/telegram/resolver — dado um bot e uma lista de @usernames (do CSV), diz quantos têm
 * telegram_id conhecido (dá pra mandar) e quantos não (sem username público no Telegram, ou
 * nunca falaram com esse bot). Usado como preview antes de confirmar o envio — sem isso o usuário
 * só saberia a taxa de match depois de já ter disparado. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as ResolverBody | null
  if (!body?.botIdentificador || !Array.isArray(body.usernames)) {
    return NextResponse.json({ error: 'botIdentificador e usernames são obrigatórios' }, { status: 400 })
  }

  const conta = await resolverContaEBotTelegram(body.botIdentificador)
  if (!conta) {
    return NextResponse.json({ error: `Bot "${body.botIdentificador}" não encontrado em nenhuma conta SendPulse configurada` }, { status: 404 })
  }

  const indice = await buscarIndiceContatosPorUsername(conta.botId, conta.apiKey)

  const encontrados: string[] = []
  const naoEncontrados: string[] = []
  for (const raw of body.usernames) {
    const username = normalizarUsername(raw)
    if (indice.has(username)) encontrados.push(username)
    else naoEncontrados.push(username)
  }

  return NextResponse.json({
    total: body.usernames.length,
    encontrados: encontrados.length,
    naoEncontrados: naoEncontrados.length,
    amostraNaoEncontrados: naoEncontrados.slice(0, 20),
  })
}
