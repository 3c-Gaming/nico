import { NextResponse } from 'next/server'
import { executarTesteParalelo } from '@/lib/bot-test/runner'
import { getSupabase } from '@/lib/db/supabase'
import { enviarMensagemGrupo } from '@/lib/integrações/whapi'
import { formatarRelatorio } from '@/lib/bot-test/report'
import { sendChannelMessage } from '@/lib/discord/verify'
import { embedResumoTestes } from '@/lib/discord/embeds'

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
  const inicio = Date.now()

  const resultados = await executarTesteParalelo()
  const duracao = Date.now() - inicio

  await supabase
    .from('bot_test_config')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', 1)

  const ok = resultados.filter((r) => r.status === 'ok').length
  const semResposta = resultados.filter((r) => r.status === 'sem_resposta').length
  const erros = resultados.filter((r) => r.status === 'erro').length

  // Notificar WhatsApp (já existente)
  const groupId = process.env.WHAPI_GROUP_ID
  if (groupId) {
    try {
      const relatorio = formatarRelatorio(resultados)
      const envio = await enviarMensagemGrupo({ groupId, texto: relatorio })
      if (!envio.ok) {
        console.error('[cron] Falha ao enviar relatório (WhatsApp):', envio.error)
      } else {
        console.log('[cron] Relatório enviado ao grupo (WhatsApp)')
      }
    } catch (err) {
      console.error('[cron] Erro ao enviar relatório (WhatsApp):', (err as Error).message)
    }
  }

  // Notificar Discord
  const discordChannelId = process.env.DISCORD_REPORT_CHANNEL_ID
  if (discordChannelId) {
    try {
      const embed = embedResumoTestes(resultados, duracao)
      await sendChannelMessage(discordChannelId, { embeds: [embed] })
      console.log('[cron] Relatório enviado ao Discord')
    } catch (err) {
      console.error('[cron] Erro ao enviar relatório (Discord):', (err as Error).message)
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
