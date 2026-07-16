import { NextResponse } from 'next/server'
import { obterBots } from '@/lib/bot-test/bot-list'
import { salvarResultado, obterResultado } from '@/lib/bot-test/store'

const BRIDGE_SECRET = process.env.BRIDGE_SECRET

interface BridgeWebhookPayload {
  from: string
  text: string
  timestamp: number
  messageId: string
}

export async function POST(req: Request) {
  try {
    if (BRIDGE_SECRET) {
      const secret = req.headers.get('x-bridge-secret')
      if (secret !== BRIDGE_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const payload: BridgeWebhookPayload = await req.json()
    if (!payload.from) {
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    const fromClean = payload.from.replace(/@s\.whatsapp\.net$/, '')
    const bots = await obterBots()
    const bot = bots.find((b) => b.numero === fromClean)

    if (!bot) {
      return NextResponse.json({ ok: true, matched: false }, { status: 200 })
    }

    const anterior = await obterResultado(bot.botId)

    if (!anterior?.pendente) {
      console.log(`[bot-test.webhook] ${bot.botId} (${bot.nome}): resposta recebida mas nao estava pendente`)
      return NextResponse.json({ ok: true, matched: true, action: 'ignored' }, { status: 200 })
    }

    const preMs = anterior.preTriggerTimestamp ? new Date(anterior.preTriggerTimestamp).getTime() : 0
    const duracaoMs = preMs > 0 ? Date.now() - preMs : 0

    console.log(`[bot-test.webhook] ${bot.botId} (${bot.nome}): resposta em ${duracaoMs}ms -> ok | texto=${JSON.stringify(payload.text.slice(0, 80))}`)

    await salvarResultado({
      ...anterior,
      status: 'ok',
      pendente: false,
      duracaoMs,
      preTriggerTimestamp: undefined,
      triggeredAt: undefined,
      ultimoTesteOkMs: Date.now(),
      ultimoTriggerOkMs: Date.now(),
    })

    return NextResponse.json({ ok: true, matched: true, action: 'marked_ok', botId: bot.botId }, { status: 200 })
  } catch (err) {
    console.error('[bot-test.webhook] erro:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 200 })
  }
}
