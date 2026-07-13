import { NextResponse } from 'next/server'
import { BOT_IDS } from '@/lib/bot-test/contact-map'
import { executarCicloTeste } from '@/lib/bot-test/runner'

export const maxDuration = 120

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const total = BOT_IDS.length
  console.log(`[cron] Testando ${total} bots...`)

  const resultados: { botId: string; status: string; erro: string | null }[] = []

  for (const botId of BOT_IDS) {
    try {
      const resultado = await executarCicloTeste(botId)
      resultados.push({
        botId,
        status: resultado.status,
        erro: resultado.erro ?? null,
      })
      console.log(`[cron] ${botId}: ${resultado.status}`)
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[cron] ${botId}: erro —`, msg)
      resultados.push({ botId, status: 'erro', erro: msg })
    }
  }

  const ok = resultados.filter((r) => r.status === 'ok').length
  const semResposta = resultados.filter((r) => r.status === 'sem_resposta').length
  const erros = resultados.filter((r) => r.status === 'erro').length

  return NextResponse.json({
    ok: true,
    total,
    ok_count: ok,
    sem_resposta: semResposta,
    erros,
    resultados,
  })
}
