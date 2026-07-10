import { runFlow } from '@/lib/mcp/sendpulse'
import { listarChats } from '@/lib/integrações/liveChat'
import { CONTACT_MAP } from './contact-map'
import { salvarResultado, obterResultado } from './store'
import type { BotTestResult, BotTestStatus } from './types'

function nowISO(): string {
  return new Date().toISOString()
}

const TAG = '[bot-test]'

const MAX_PAGES = 5
const PAGE_SIZE = 100

async function obterAtividadeContato(botId: string, contactId: string): Promise<string | null> {
  for (let pagina = 0; pagina < MAX_PAGES; pagina++) {
    try {
      const { chats } = await listarChats(botId, PAGE_SIZE, pagina * PAGE_SIZE)
      const contato = chats.find(c => c.contactId === contactId)
      if (contato?.ultimaAtividade) {
        return contato.ultimaAtividade
      }
      if (chats.length === 0) break
    } catch (err) {
      console.error(TAG, `obterAtividadeContato ${botId}: erro na pagina ${pagina}`, err)
      return null
    }
  }
  return null
}

async function verificarPendente(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const anterior = await obterResultado(botId)
  if (!anterior?.pendente) return

  const posAtividade = await obterAtividadeContato(botId, config.contactId)

  if (!posAtividade) {
    console.error(TAG, `verificarPendente ${botId}: falha ao obter atividade pos-flow`)
    await salvarResultado({
      ...anterior,
      status: 'erro',
      pendente: false,
      preTriggerTimestamp: undefined,
      triggeredAt: undefined,
      erro: 'obterAtividadeContato falhou',
      ultimoTesteOkMs: anterior.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: anterior.ultimoTriggerOkMs ?? undefined,
    })
    return
  }

  const preMs = anterior.preTriggerTimestamp ? new Date(anterior.preTriggerTimestamp).getTime() : NaN
  const posMs = new Date(posAtividade).getTime()
  const temNovaAtividade = !isNaN(preMs) && !isNaN(posMs) && posMs > preMs
  const status: BotTestStatus = temNovaAtividade ? 'ok' : 'sem_resposta'

  console.log(TAG, `verificarPendente ${botId}: preMs=${preMs} posMs=${posMs} nova=${temNovaAtividade} -> ${status}`)

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

  if (text.startsWith('Tool execution failed')) {
    console.error(TAG, `dispararFlow ${botId}: erro tool:`, text.slice(0, 200))
    return { ok: false, erro: text }
  }

  return { ok: true }
}

async function iniciarNovoCiclo(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const preTimestamp = nowISO()

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
    const preTimestamp = nowISO()

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

    const posAtividade = await obterAtividadeContato(botId, config.contactId)
    const preMs = new Date(preTimestamp).getTime()

    if (!posAtividade) {
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'sem_resposta',
        duracaoMs: Date.now() - inicio,
        ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
        ultimoTriggerOkMs: Date.now(),
      }
      await salvarResultado(resultado)
      return resultado
    }

    const posMs = new Date(posAtividade).getTime()
    const temNovaAtividade = !isNaN(preMs) && !isNaN(posMs) && posMs > preMs
    const status: BotTestStatus = temNovaAtividade ? 'ok' : 'sem_resposta'

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
