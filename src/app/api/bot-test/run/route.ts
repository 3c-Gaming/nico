import { NextResponse } from 'next/server'
import { BOT_IDS } from '@/lib/bot-test/contact-map'
import { executarCicloTeste, executarTesteManual } from '@/lib/bot-test/runner'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { botId: botIdParam, manual } = body

  if (botIdParam) {
    if (!BOT_IDS.includes(botIdParam)) {
      return NextResponse.json({ erro: 'Bot ID invalido' }, { status: 400 })
    }
    if (manual) {
      executarTesteManual(botIdParam).catch(err => {
        console.error(`[bot-test] Erro no bot ${botIdParam}:`, err)
      })
    } else {
      executarCicloTeste(botIdParam).catch(err => {
        console.error(`[bot-test] Erro no bot ${botIdParam}:`, err)
      })
    }
    return NextResponse.json({ executado: true, botId: botIdParam, manual: !!manual })
  }

  for (const botId of BOT_IDS) {
    executarCicloTeste(botId).catch(err => {
      console.error(`[bot-test] Erro no bot ${botId}:`, err)
    })
  }
  return NextResponse.json({ executado: true, total: BOT_IDS.length })
}
