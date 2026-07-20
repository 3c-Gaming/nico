import { obterBots, obterBotsPinados } from './bot-list'
import { salvarResultado, obterResultado } from './store'
import { enviarMensagemDireta } from '@/lib/integrações/sendpulse'
import { getSupabase } from '@/lib/db/supabase'
import type { BotTestResult } from './types'

function nowISO(): string {
  return new Date().toISOString()
}

const TAG = '[bot-test]'

async function obterBotContactIds(): Promise<Record<string, string>> {
  try {
    const sb = getSupabase() as any
    if (!sb) return {}
    const { data } = await sb.from('bot_test_config').select('bot_contact_ids').eq('id', 1).maybeSingle()
    return data?.bot_contact_ids ?? {}
  } catch {
    return {}
  }
}

const MSG_AVISO = 'O contact_id deste bot precisa receber uma interação manual para voltar a ser testado.'

function isContactNotActive(resposta: { ok: boolean; statusCode: number; body: unknown }): boolean {
  if (resposta.ok || resposta.statusCode !== 422) return false
  const bodyStr = JSON.stringify(resposta.body).toLowerCase()
  return bodyStr.includes('contact is not active')
}

export async function executarCicloTeste(botId: string): Promise<BotTestResult> {
  const bots = await obterBots()
  const config = bots.find((b) => b.botId === botId)

  if (!config) {
    return {
      botId,
      numero: '',
      nome: 'Desconhecido',
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: 'Bot nao encontrado na API SendPulse',
    }
  }

  const inicio = Date.now()

  try {
    const botContactIds = await obterBotContactIds()
    const contactId = botContactIds[botId]

    if (!contactId) {
      const existente = await obterResultado(botId)
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: 'Contact ID nao configurado para este bot',
        ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
        ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
      }
      await salvarResultado(resultado)
      return resultado
    }

    const resposta = await enviarMensagemDireta({
      contactId,
      botId,
      texto: 'TESTE_NUMERO',
    })

    const requestBody = {
      contact_id: contactId,
      bot_id: botId,
      message: { type: 'text', text: { body: 'TESTE_NUMERO' } },
    }

    const duracaoMs = Date.now() - inicio
    const existente = await obterResultado(botId)

    const resultado: BotTestResult = {
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: isContactNotActive(resposta) ? 'aviso' : (resposta.ok ? 'ok' : 'erro'),
      duracaoMs,
      erro: resposta.ok
        ? undefined
        : isContactNotActive(resposta)
          ? MSG_AVISO
          : `HTTP ${resposta.statusCode}: ${JSON.stringify(resposta.body).slice(0, 200)}`,
      ultimoTesteOkMs: resposta.ok ? Date.now() : (existente?.ultimoTesteOkMs ?? undefined),
      ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
      requestBody,
      responseBody: resposta.body,
    }
    await salvarResultado(resultado)
    console.log(TAG, `executarCicloTeste ${botId}: ${resultado.status} (${duracaoMs}ms)`)
    return resultado
  } catch (err) {
    const duracaoMs = Date.now() - inicio
    console.error(TAG, `executarCicloTeste ${botId}: erro -`, (err as Error).message)
    const existente = await obterResultado(botId)
    const resultado: BotTestResult = {
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs,
      erro: (err as Error).message,
      ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
    }
    await salvarResultado(resultado)
    return resultado
  }
}

export async function executarTesteManual(botId: string): Promise<BotTestResult> {
  return executarCicloTeste(botId)
}

export async function executarTesteParalelo(): Promise<BotTestResult[]> {
  const inicio = Date.now()

  const bots = await obterBotsPinados()
  console.log(TAG, `executarTesteParalelo: enviando para ${bots.length} bots...`)

  const botContactIds = await obterBotContactIds()

  const envios = await Promise.allSettled(
    bots.map(async (config) => {
      const contactId = botContactIds[config.botId]
      if (!contactId) throw new Error('Contact ID nao configurado')
      const requestBody = {
        contact_id: contactId,
        bot_id: config.botId,
        message: { type: 'text', text: { body: 'TESTE_NUMERO' } },
      }
      const resposta = await enviarMensagemDireta({
        contactId,
        botId: config.botId,
        texto: 'TESTE_NUMERO',
      })
      return { config, resposta, requestBody }
    })
  )

  const resultados: BotTestResult[] = []

  for (const e of envios) {
    if (e.status === 'rejected') {
      const resultado: BotTestResult = {
        botId: 'unknown',
        numero: '',
        nome: 'Desconhecido',
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: (e.reason as Error).message,
      }
      resultados.push(resultado)
      continue
    }

    const { config, resposta, requestBody } = e.value
    const existente = await obterResultado(config.botId)
    const resultado: BotTestResult = {
      botId: config.botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: isContactNotActive(resposta) ? 'aviso' : (resposta.ok ? 'ok' : 'erro'),
      duracaoMs: Date.now() - inicio,
      erro: resposta.ok
        ? undefined
        : isContactNotActive(resposta)
          ? MSG_AVISO
          : `HTTP ${resposta.statusCode}: ${JSON.stringify(resposta.body).slice(0, 200)}`,
      ultimoTesteOkMs: resposta.ok ? Date.now() : (existente?.ultimoTesteOkMs ?? undefined),
      ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
      requestBody,
      responseBody: resposta.body,
    }
    await salvarResultado(resultado)
    resultados.push(resultado)
    console.log(TAG, `${config.botId}: ${resultado.status}`)
  }

  console.log(TAG, `executarTesteParalelo: concluido em ${Date.now() - inicio}ms`)
  return resultados
}
