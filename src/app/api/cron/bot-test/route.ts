import { NextResponse } from 'next/server'
import { BOT_IDS } from '@/lib/bot-test/contact-map'
import { executarCicloTeste } from '@/lib/bot-test/runner'
import { getSupabase } from '@/lib/db/supabase'

export const maxDuration = 120

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase() as any
  if (!supabase) {
    return NextResponse.json({ erro: 'Supabase não disponível' }, { status: 500 })
  }

  const { data: config } = await supabase
    .from('bot_test_config')
    .select('cron_paused, poll_interval_ms, last_run_at')
    .eq('id', 1)
    .maybeSingle()

  if (config?.cron_paused) {
    console.log('[cron] Pausado pelo usuário. Pulando ciclo.')
    return NextResponse.json({ ok: true, skipped: true, reason: 'paused' })
  }

  if (config?.last_run_at && config?.poll_interval_ms) {
    const elapsed = Date.now() - new Date(config.last_run_at).getTime()
    if (elapsed < config.poll_interval_ms) {
      const remaining = Math.round((config.poll_interval_ms - elapsed) / 1000)
      console.log(`[cron] Intervalo nao atingido. Faltam ${remaining}s.`)
      return NextResponse.json({ ok: true, skipped: true, reason: 'interval', remainingSeconds: remaining })
    }
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

  await supabase
    .from('bot_test_config')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', 1)

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
