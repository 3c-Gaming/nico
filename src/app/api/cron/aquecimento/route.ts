import { NextResponse } from 'next/server'
import {
  requireSupabase,
  listarAquecimentoExecucoes,
  obterAquecimentoPar,
  obterAquecimentoScript,
  obterAquecimentoNumero,
  obterAquecimentoConfig,
} from '@/lib/aquecimento/db'
import { listarContasSendpulse } from '@/lib/integrações/contasSendpulse'
import { enviarMensagemDireta } from '@/lib/integrações/sendpulse'
import { jitterSegundos, proximoHorarioNaJanela } from '@/lib/aquecimento/jitter'
import { hojeBrasilISO } from '@/lib/datas'

export const maxDuration = 120

const ATRASO_PADRAO_SEGUNDOS = 180

function tetoDoDia(rampa: Record<string, number>, diaAtual: number): number {
  const dias = Object.keys(rampa).map(Number).filter((d) => !Number.isNaN(d)).sort((a, b) => a - b)
  if (dias.length === 0) return 2
  let teto = rampa[String(dias[0])]
  for (const dia of dias) {
    if (dia > diaAtual) break
    teto = rampa[String(dia)]
  }
  return teto
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const config = await obterAquecimentoConfig()
  if (config.cronPaused) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'paused' })
  }

  const agora = new Date()
  const horaBrasilia = Number(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  if (horaBrasilia < config.janelaInicioHora || horaBrasilia >= config.janelaFimHora) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'outside_hours' })
  }

  const todasExecucoes = await listarAquecimentoExecucoes()
  const vencidas = todasExecucoes.filter(
    (e) => e.status === 'em_andamento' && e.proximaMensagemEm && new Date(e.proximaMensagemEm) <= agora
  )

  const supabase = requireSupabase()
  const contas = listarContasSendpulse()
  const hojeKey = hojeBrasilISO()

  const resultados: { execucaoId: string; ok: boolean; motivo?: string }[] = []

  for (const execucao of vencidas) {
    try {
      const par = await obterAquecimentoPar(execucao.parId)
      const script = await obterAquecimentoScript(execucao.scriptId)

      if (!par || !par.ativo || !script || !script.ativo) {
        resultados.push({ execucaoId: execucao.id, ok: false, motivo: 'par ou script inativo/inexistente' })
        continue
      }

      const mensagem = script.mensagens[execucao.proximoIndice]
      if (!mensagem) {
        await supabase.from('aquecimento_execucoes').update({ status: 'concluida', proxima_mensagem_em: null }).eq('id', execucao.id)
        resultados.push({ execucaoId: execucao.id, ok: true, motivo: 'script concluído' })
        continue
      }

      const remetenteBotId = mensagem.de === 'A' ? par.botIdA : par.botIdB
      const contactIdDestino = mensagem.de === 'A' ? par.contactIdA : par.contactIdB

      if (!contactIdDestino) {
        // sem contact_id configurado nesse sentido — adia 15min pra não martelar toda passada do cron
        await supabase.from('aquecimento_execucoes').update({ proxima_mensagem_em: new Date(agora.getTime() + 15 * 60_000).toISOString() }).eq('id', execucao.id)
        resultados.push({ execucaoId: execucao.id, ok: false, motivo: `par sem contact_id do lado ${mensagem.de}` })
        continue
      }

      const numero = await obterAquecimentoNumero(remetenteBotId)
      if (!numero || numero.status === 'pausado') {
        await supabase.from('aquecimento_execucoes').update({ proxima_mensagem_em: new Date(agora.getTime() + 15 * 60_000).toISOString() }).eq('id', execucao.id)
        resultados.push({ execucaoId: execucao.id, ok: false, motivo: 'número não aquecendo/pausado' })
        continue
      }

      const diaAtual = Math.max(1, Math.floor((agora.getTime() - new Date(numero.iniciadoEm).getTime()) / 86_400_000) + 1)
      const teto = tetoDoDia(config.rampa, diaAtual)
      const resetaHoje = numero.mensagensHojeData !== hojeKey
      const mensagensHojeAtual = resetaHoje ? 0 : numero.mensagensHoje

      if (mensagensHojeAtual >= teto) {
        const amanha = new Date(agora)
        amanha.setUTCDate(amanha.getUTCDate() + 1)
        const proximaJanela = proximoHorarioNaJanela(amanha, config.janelaInicioHora, config.janelaFimHora)
        await supabase.from('aquecimento_execucoes').update({ proxima_mensagem_em: proximaJanela.toISOString() }).eq('id', execucao.id)
        resultados.push({ execucaoId: execucao.id, ok: false, motivo: `teto diário (${teto}) atingido pro dia ${diaAtual}` })
        continue
      }

      const conta = contas.find((c) => c.id === numero.contaId)
      if (!conta) {
        resultados.push({ execucaoId: execucao.id, ok: false, motivo: `conta ${numero.contaId} não configurada` })
        continue
      }

      const envio = await enviarMensagemDireta({
        botId: remetenteBotId,
        contactId: contactIdDestino,
        texto: mensagem.texto,
        apiKey: conta.apiKey,
      })

      if (!envio.ok) {
        await supabase.from('aquecimento_execucoes').update({ proxima_mensagem_em: new Date(agora.getTime() + 5 * 60_000).toISOString() }).eq('id', execucao.id)
        resultados.push({ execucaoId: execucao.id, ok: false, motivo: `envio falhou (status ${envio.statusCode})` })
        continue
      }

      await supabase.from('aquecimento_numeros').update({
        mensagens_hoje: mensagensHojeAtual + 1,
        mensagens_hoje_data: hojeKey,
        ultima_mensagem_em: agora.toISOString(),
      }).eq('bot_id', remetenteBotId)

      const novoIndice = execucao.proximoIndice + 1
      if (novoIndice >= script.mensagens.length) {
        await supabase.from('aquecimento_execucoes').update({
          proximo_indice: novoIndice, status: 'concluida', proxima_mensagem_em: null, atualizada_em: agora.toISOString(),
        }).eq('id', execucao.id)
      } else {
        const atrasoSegundos = jitterSegundos(mensagem.atrasoSegundos ?? ATRASO_PADRAO_SEGUNDOS)
        const proxima = proximoHorarioNaJanela(new Date(agora.getTime() + atrasoSegundos * 1000), config.janelaInicioHora, config.janelaFimHora)
        await supabase.from('aquecimento_execucoes').update({
          proximo_indice: novoIndice, proxima_mensagem_em: proxima.toISOString(), atualizada_em: agora.toISOString(),
        }).eq('id', execucao.id)
      }

      resultados.push({ execucaoId: execucao.id, ok: true })
    } catch (err) {
      resultados.push({ execucaoId: execucao.id, ok: false, motivo: (err as Error).message })
    }
  }

  return NextResponse.json({ ok: true, verificadas: vencidas.length, resultados })
}
