import { NextResponse } from 'next/server'
import { BOT_IDS } from '@/lib/bot-test/contact-map'
import { executarTesteManual } from '@/lib/bot-test/runner'
import { iniciarCron } from '@/lib/bot-test/cron'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { botId: botIdParam } = body

  if (botIdParam) {
    if (!BOT_IDS.includes(botIdParam)) {
      return NextResponse.json({ erro: 'Bot ID invalido' }, { status: 400 })
    }
    const resultado = await executarTesteManual(botIdParam)
    return NextResponse.json({ executado: true, ...resultado })
  }

  iniciarCron()

  return NextResponse.json({ executado: true, total: BOT_IDS.length })
}
