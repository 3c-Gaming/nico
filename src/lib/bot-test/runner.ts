import { runFlow, listChatMessages } from '@/lib/mcp/sendpulse'
import { CONTACT_MAP } from './contact-map'
import { salvarResultado, obterResultado } from './store'
import type { BotTestResult, BotTestStatus } from './types'

function nowISO(): string {
  return new Date().toISOString()
}

function isToolError(texto: string): boolean {
  return texto.startsWith('Tool execution failed')
}

const TAG = '[bot-test]'

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
    console.error(TAG, 'extrairUltimoTimestamp: erro ao parsear JSON —', texto.slice(0, 500))
  }
  return null
}

async function listChatMessagesComRetry(params: {
  channel: string
  contactId: string
  limit: number
  order: 'asc' | 'desc'
}, tentativas = 2): Promise<string | null> {
  for (let i = 0; i <= tentativas; i++) {
    const result = await listChatMessages(params)
    if (result && !isToolError(result)) return result
    console.warn(TAG, `listChatMessages tentativa ${i + 1}/${tentativas + 1} falhou:`, result?.slice(0, 200))
    if (i < tentativas) await new Promise(r => setTimeout(r, 2000))
  }
  return null
}

async function verificarPendente(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const anterior = await obterResultado(botId)
  if (!anterior?.pendente) return

  const posMessagesText = await listChatMessagesComRetry({
    channel: 'whatsapp',
    contactId: config.contactId,
    limit: 5,
    order: 'desc',
  })

  if (!posMessagesText) {
    console.error(TAG, `verificarPendente ${botId}: todas as tentativas falharam`)
    await salvarResultado({
      ...anterior,
      status: 'erro',
      pendente: false,
      preTriggerTimestamp: undefined,
      triggeredAt: undefined,
      erro: 'listChatMessages falhou apos todas as tentativas',
      ultimoTesteOkMs: anterior.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: anterior.ultimoTriggerOkMs ?? undefined,
    })
    return
  }

  const posTimestamp = extrairUltimoTimestamp(posMessagesText)
  const temNovaMensagem = posTimestamp !== null && posTimestamp !== anterior.preTriggerTimestamp
  const status: BotTestStatus = temNovaMensagem ? 'ok' : 'sem_resposta'

  console.log(TAG, `verificarPendente ${botId}: pre=${anterior.preTriggerTimestamp} pos=${posTimestamp} nova=${temNovaMensagem} -> ${status}`)

  await salvarResultado({
    ...anterior,
    status,
    pendente: false,
    preTriggerTimestamp: undefined,
    triggeredAt: undefined,
    ultimoTesteOkMs: status === 'ok' ? Date.now() : (anterior.ultimoTesteOkMs ?? undefined),
    ultimoTriggerOkMs: anterior.ultimoTriggerOkMs ?? undefined,
  })
}

async function dispararFlow(botId: string, config: typeof CONTACT_MAP[string]): Promise<{ ok: boolean; erro?: string }> {
  const flowResult = await runFlow({
    channel: 'whatsapp',
    contactId: config.contactId,
    flowId: config.flowId,
  })

  if (!flowResult) {
    console.error(TAG, `dispararFlow ${botId}: resposta vazia`)
    return { ok: false, erro: 'Flow retornou resposta vazia' }
  }

  const text = typeof flowResult === 'string' ? flowResult : JSON.stringify(flowResult)
  console.log(TAG, `dispararFlow ${botId}: resposta (200 chars)`, text.slice(0, 200))

  if (isToolError(text)) {
    console.error(TAG, `dispararFlow ${botId}: erro tool:`, text.slice(0, 200))
    return { ok: false, erro: text }
  }

  return { ok: true }
}

async function iniciarNovoCiclo(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const preMessagesText = await listChatMessagesComRetry({
    channel: 'whatsapp',
    contactId: config.contactId,
    limit: 1,
    order: 'desc',
  })

  if (!preMessagesText) {
    console.error(TAG, `iniciarNovoCiclo ${botId}: todas as tentativas falharam`)
    const existente = await obterResultado(botId)
    await salvarResultado({
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: 'listChatMessages falhou apos todas as tentativas',
      ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
    })
    return
  }

  const preTimestamp = extrairUltimoTimestamp(preMessagesText)

  const flow = await dispararFlow(botId, config)
  const existente = await obterResultado(botId)

  if (!flow.ok) {
    await salvarResultado({
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: flow.erro,
      ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
    })
    return
  }

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
    ultimoTriggerOkMs: Date.now(),
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
    const preMessagesText = await listChatMessagesComRetry({
      channel: 'whatsapp',
      contactId: config.contactId,
      limit: 1,
      order: 'desc',
    })

    if (!preMessagesText) {
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: 'listChatMessages falhou apos todas as tentativas',
      }
      await salvarResultado(resultado)
      return resultado
    }

    const preTimestamp = extrairUltimoTimestamp(preMessagesText)

    const flow = await dispararFlow(botId, config)
    if (!flow.ok) {
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: flow.erro,
      }
      await salvarResultado(resultado)
      return resultado
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
      ultimoTriggerOkMs: Date.now(),
    })

    await new Promise(resolve => setTimeout(resolve, 55_000))

    const posMessagesText = await listChatMessagesComRetry({
      channel: 'whatsapp',
      contactId: config.contactId,
      limit: 5,
      order: 'desc',
    })

    if (!posMessagesText) {
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: 'listChatMessages falhou apos todas as tentativas (pos)',
        ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
        ultimoTriggerOkMs: Date.now(),
      }
      await salvarResultado(resultado)
      return resultado
    }

    const posTimestamp = extrairUltimoTimestamp(posMessagesText)
    const temNovaMensagem = posTimestamp !== null && posTimestamp !== preTimestamp
    const status: BotTestStatus = temNovaMensagem ? 'ok' : 'sem_resposta'

    const resultado: BotTestResult = {
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status,
      duracaoMs: Date.now() - inicio,
      ultimoTesteOkMs: status === 'ok' ? Date.now() : (existente?.ultimoTesteOkMs ?? undefined),
      ultimoTriggerOkMs: Date.now(),
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
