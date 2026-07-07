import { NextResponse } from 'next/server'
import { processarRespostaWhatsApp } from '@/lib/testes/runner'

interface WebhookPayload {
  from: string
  text: string
  messageId?: string
}

const BRIDGE_SECRET = process.env.BRIDGE_SECRET

export async function POST(req: Request) {
  try {
    const secret = req.headers.get('x-bridge-secret')
    if (BRIDGE_SECRET && secret !== BRIDGE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload: WebhookPayload = await req.json()
    if (!payload.from || !payload.text) {
      return NextResponse.json({ error: 'from e text são obrigatórios' }, { status: 400 })
    }

    const resultado = await processarRespostaWhatsApp(
      payload.from,
      payload.text,
      payload.messageId || ''
    )

    return NextResponse.json({ matched: !!resultado, resultado })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
