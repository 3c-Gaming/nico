import { NextResponse } from 'next/server'
import { executarTesteParalelo } from '@/lib/bot-test/runner'
import { getSupabase } from '@/lib/db/supabase'
import { enviarMensagemGrupo } from '@/lib/integrações/whapi'
import { formatarRelatorio } from '@/lib/bot-test/report'

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

  console.log('[cron] Testando bots em paralelo...')

  const resultados = await executarTesteParalelo()

  await supabase
    .from('bot_test_config')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', 1)

  const ok = resultados.filter((r) => r.status === 'ok').length
  const semResposta = resultados.filter((r) => r.status === 'sem_resposta').length
  const erros = resultados.filter((r) => r.status === 'erro').length

  const groupId = process.env.WHAPI_GROUP_ID
  if (groupId) {
    try {
      const relatorio = formatarRelatorio(resultados)
      const envio = await enviarMensagemGrupo({ groupId, texto: relatorio })
      if (!envio.ok) {
        console.error('[cron] Falha ao enviar relatório:', envio.error)
      } else {
        console.log('[cron] Relatório enviado ao grupo')
      }
    } catch (err) {
      console.error('[cron] Erro ao enviar relatório:', (err as Error).message)
    }
  }

  return NextResponse.json({
    ok: true,
    total: resultados.length,
    ok_count: ok,
    sem_resposta: semResposta,
    erros,
    resultados,
  })
}
