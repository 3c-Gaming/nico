import { runFlow, listChatMessages } from '@/lib/mcp/sendpulse'
import { CONTACT_MAP } from './contact-map'
import { salvarResultado, obterResultado } from './store'
import type { BotTestResult, BotTestStatus } from './types'

function nowISO(): string {
  return new Date().toISOString()
}

function extrairUltimoTimestamp(texto: string): string | null {
  try {
    const parsed = JSON.parse(texto)
    const data = parsed.data ?? parsed ?? []
    const arr = Array.isArray(data) ? data : [data]
    for (const msg of arr) {
      if (msg?.created_at) return msg.created_at
      if (msg?.date) return msg.date
      if (msg?.timestamp) return String(msg.timestamp)
    }
  } catch {
    console.error('[bot-test] extrairUltimoTimestamp: erro ao parsear JSON —', texto.slice(0, 500))
  }
  return null
}

async function verificarPendente(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const anterior = await obterResultado(botId)
  if (!anterior?.pendente) return

  const posMessagesText = await listChatMessages({
    channel: 'whatsapp',
    contactId: config.contactId,
    limit: 5,
    order: 'desc',
  })

  const posTimestamp = extrairUltimoTimestamp(posMessagesText)
  const temNovaMensagem = posTimestamp !== null && posTimestamp !== anterior.preTriggerTimestamp
  const status: BotTestStatus = temNovaMensagem ? 'ok' : 'sem_resposta'

  console.log(`[bot-test] verificarPendente ${botId}: preTimestamp=${anterior.preTriggerTimestamp} posTimestamp=${posTimestamp} temNovaMensagem=${temNovaMensagem} -> ${status}`)

  await salvarResultado({
    ...anterior,
    status,
    pendente: false,
    preTriggerTimestamp: undefined,
    triggeredAt: undefined,
    ultimoTesteOkMs: status === 'ok' ? Date.now() : (anterior.ultimoTesteOkMs ?? undefined),
  })
}

async function iniciarNovoCiclo(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const preMessagesText = await listChatMessages({
    channel: 'whatsapp',
    contactId: config.contactId,
    limit: 1,
    order: 'desc',
  })

  const preTimestamp = extrairUltimoTimestamp(preMessagesText)

  const flowResult = await runFlow({
    channel: 'whatsapp',
    contactId: config.contactId,
    flowId: config.flowId,
  })

  if (!flowResult) {
    await salvarResultado({
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: 'Flow retornou resposta vazia',
    })
    return
  }

  const existente = await obterResultado(botId)

  await salvarResultado({
    botId,
    numero: config.numero,
    nome: config.nome,
    ultimoTeste: nowISO(),
    status: existente?.status ?? 'pendente',
    duracaoMs: 0,
    pendente: true,
    preTriggerTimestamp: preTimestamp,
    triggeredAt: nowISO(),
    ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
  })
}

export async function executarCicloTeste(botId: string): Promise<BotTestResult> {
  const config = CONTACT_MAP[botId]
  if (!config) {
    return {
      botId,
      numero: '',
      nome: 'Desconhecido',
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: 'Bot nao encontrado no contact-map',
    }
  }

  try {
    await verificarPendente(botId, config)
    const resolvido = await obterResultado(botId)
    await iniciarNovoCiclo(botId, config)
    return resolvido ?? {
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: 'Falha ao obter resultado apos ciclo',
    }
  } catch (err) {
    const resultado: BotTestResult = {
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: (err as Error).message,
    }
    await salvarResultado(resultado)
    return resultado
  }
}

export async function executarTesteManual(botId: string): Promise<BotTestResult> {
  const config = CONTACT_MAP[botId]
  if (!config) {
    return {
      botId,
      numero: '',
      nome: 'Desconhecido',
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: 'Bot nao encontrado no contact-map',
    }
  }

  const inicio = Date.now()

  try {
    const preMessagesText = await listChatMessages({
      channel: 'whatsapp',
      contactId: config.contactId,
      limit: 1,
      order: 'desc',
    })

    const preTimestamp = extrairUltimoTimestamp(preMessagesText)

    const flowResult = await runFlow({
      channel: 'whatsapp',
      contactId: config.contactId,
      flowId: config.flowId,
    })

    if (!flowResult) {
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: 'Flow retornou resposta vazia',
      }
      await salvarResultado(resultado)
      return resultado
    }

    await new Promise(resolve => setTimeout(resolve, 55_000))

    const posMessagesText = await listChatMessages({
      channel: 'whatsapp',
      contactId: config.contactId,
      limit: 5,
      order: 'desc',
    })

    const posTimestamp = extrairUltimoTimestamp(posMessagesText)
    const temNovaMensagem = posTimestamp !== null && posTimestamp !== preTimestamp
    const status: BotTestStatus = temNovaMensagem ? 'ok' : 'sem_resposta'

    const existente = await obterResultado(botId)
    const resultado: BotTestResult = {
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status,
      duracaoMs: Date.now() - inicio,
      ultimoTesteOkMs: status === 'ok' ? Date.now() : (existente?.ultimoTesteOkMs ?? undefined),
    }
    await salvarResultado(resultado)
    return resultado
  } catch (err) {
    const resultado: BotTestResult = {
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: Date.now() - inicio,
      erro: (err as Error).message,
    }
    await salvarResultado(resultado)
    return resultado
  }
}
