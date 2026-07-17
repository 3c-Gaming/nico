import { NextResponse } from 'next/server'
import { obterBotsPinados } from '@/lib/bot-test/bot-list'
import { executarCicloTeste } from '@/lib/bot-test/runner'
import { getSupabase } from '@/lib/db/supabase'
import { enviarMensagemGrupo } from '@/lib/integrações/whapi'
import { formatarRelatorio } from '@/lib/bot-test/report'
import { sendChannelMessage } from '@/lib/discord/verify'
import { embedResultadoTeste, embedResumoTestes } from '@/lib/discord/embeds'

export const maxDuration = 120

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const agora = new Date()
  const horaBrasilia = Number(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  if (horaBrasilia < 6 || horaBrasilia >= 23) {
    console.log(`[cron] Fora do horário (${horaBrasilia}h). Pulando.`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'outside_hours' })
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

  console.log('[cron] Testando bots pinados sequencialmente...')
  const inicio = Date.now()

  const discordChannelId = process.env.DISCORD_REPORT_CHANNEL_ID
  const bots = await obterBotsPinados()

  if (bots.length === 0) {
    console.log('[cron] Nenhum bot pinado encontrado.')
    await supabase
      .from('bot_test_config')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', 1)
    return NextResponse.json({ ok: true, total: 0, message: 'Nenhum bot pinado' })
  }

  console.log(`[cron] ${bots.length} bots pinados. Iniciando testes...`)

  if (discordChannelId) {
    try {
      await sendChannelMessage(discordChannelId, { content: `🔍 Cron: testando ${bots.length} bot(s) fixados...` })
    } catch {}
  }

  const resultados: Awaited<ReturnType<typeof executarCicloTeste>>[] = []

  for (const bot of bots) {
    try {
      const resultado = await executarCicloTeste(bot.botId)
      resultados.push(resultado)
      console.log(`[cron] ${bot.botId}: ${resultado.status} (${resultado.duracaoMs}ms)`)

      if (discordChannelId) {
        try {
          await sendChannelMessage(discordChannelId, { embeds: [embedResultadoTeste(resultado)] })
        } catch (err) {
          console.error('[cron] Erro ao enviar resultado individual ao Discord:', (err as Error).message)
        }
      }
    } catch (err) {
      console.error(`[cron] Erro ao testar ${bot.botId}:`, (err as Error).message)
      resultados.push({
        botId: bot.botId,
        numero: bot.numero,
        nome: bot.nome,
        ultimoTeste: new Date().toISOString(),
        status: 'erro',
        duracaoMs: 0,
        erro: (err as Error).message,
      })
    }
  }

  const duracao = Date.now() - inicio

  await supabase
    .from('bot_test_config')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', 1)

  const ok = resultados.filter((r) => r.status === 'ok').length
  const semResposta = resultados.filter((r) => r.status === 'sem_resposta').length
  const erros = resultados.filter((r) => r.status === 'erro').length

  // Notificar WhatsApp
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

  // Notificar Discord — resumo final
  if (discordChannelId) {
    try {
      const embed = embedResumoTestes(resultados, duracao)
      await sendChannelMessage(discordChannelId, { embeds: [embed] })
      console.log('[cron] Resumo enviado ao Discord')
    } catch (err) {
      console.error('[cron] Erro ao enviar resumo (Discord):', (err as Error).message)
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
