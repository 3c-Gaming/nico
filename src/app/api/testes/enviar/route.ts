import { NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:3001'

export async function POST(req: Request) {
  try {
    const { to, text } = await req.json()
    if (!to || !text) {
      return NextResponse.json({ success: false, error: 'to e text sao obrigatorios' }, { status: 400 })
    }

    const numero = to.replace(/\D/g, '')
    const jid = numero.startsWith('55') ? numero : '55' + numero

    const res = await fetch(BRIDGE_URL + '/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: jid, text }),
      signal: AbortSignal.timeout(30000),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 502 })
  }
}
