import { NextResponse } from 'next/server'
import { CONTACT_MAP } from '@/lib/bot-test/contact-map'
import { salvarResultado, obterResultado } from '@/lib/bot-test/store'

const BRIDGE_SECRET = process.env.BRIDGE_SECRET

interface BridgeWebhookPayload {
  from: string
  text: string
  timestamp: number
  messageId: string
}

function botIdByNumero(numero: string): string | null {
  for (const [id, config] of Object.entries(CONTACT_MAP)) {
    if (config.numero === numero) return id
  }
  return null
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
    const botId = botIdByNumero(fromClean)

    if (!botId) {
      return NextResponse.json({ ok: true, matched: false }, { status: 200 })
    }

    const config = CONTACT_MAP[botId]
    const anterior = await obterResultado(botId)

    if (!anterior?.pendente) {
      console.log(`[bot-test.webhook] ${botId} (${config.nome}): resposta recebida mas nao estava pendente`)
      return NextResponse.json({ ok: true, matched: true, action: 'ignored' }, { status: 200 })
    }

    const preMs = anterior.preTriggerTimestamp ? new Date(anterior.preTriggerTimestamp).getTime() : 0
    const duracaoMs = preMs > 0 ? Date.now() - preMs : 0

    console.log(`[bot-test.webhook] ${botId} (${config.nome}): resposta em ${duracaoMs}ms -> ok`)

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

    return NextResponse.json({ ok: true, matched: true, action: 'marked_ok', botId }, { status: 200 })
  } catch (err) {
    console.error('[bot-test.webhook] erro:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 200 })
  }
}
