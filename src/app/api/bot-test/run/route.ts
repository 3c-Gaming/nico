import { NextResponse } from 'next/server'
import { BOT_IDS } from '@/lib/bot-test/contact-map'
import { executarTesteManual } from '@/lib/bot-test/runner'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { botId: botIdParam } = body

  if (!botIdParam || !BOT_IDS.includes(botIdParam)) {
    return NextResponse.json({ erro: 'Informe um botId valido' }, { status: 400 })
  }

  const resultado = await executarTesteManual(botIdParam)
  return NextResponse.json({ executado: true, ...resultado })
}
