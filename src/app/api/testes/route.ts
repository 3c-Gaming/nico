import { NextResponse } from 'next/server'
import { executarTesteManual } from '@/lib/bot-test/runner'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.botId) {
      return NextResponse.json({ error: 'botId é obrigatório' }, { status: 400 })
    }
    const resultado = await executarTesteManual(body.botId)
    return NextResponse.json({ resultado })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
