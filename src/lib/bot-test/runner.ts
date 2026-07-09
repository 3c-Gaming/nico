import { runFlow, getContactWhatsApp } from '@/lib/mcp/sendpulse'
import { CONTACT_MAP } from './contact-map'
import { salvarResultado, obterResultado } from './store'
import type { BotTestResult, BotTestStatus } from './types'

function nowISO(): string {
  return new Date().toISOString()
}

const TAG = '[bot-test]'

function extrairAtividade(info: Record<string, unknown> | null): string | null {
  if (!info) return null
  return (info.last_activity as string) ??
    (info.ultima_actividade as string) ??
    (info.updated_at as string) ??
    (info.date_added as string) ??
    null
}

async function obterAtividadeContato(contactId: string, tentativas = 2): Promise<{
  atividade: string | null
  raw: Record<string, unknown> | null
  erro?: string
}> {
  for (let i = 0; i <= tentativas; i++) {
    const info = await getContactWhatsApp(contactId)
    if (info) {
      const atividade = extrairAtividade(info)
      console.log(TAG, `obterAtividadeContato ${contactId}: atividade=${atividade}`, JSON.stringify(info).slice(0, 400))
      return { atividade, raw: info }
    }
    console.warn(TAG, `getContactWhatsApp tentativa ${i + 1}/${tentativas + 1} falhou`)
    if (i < tentativas) await new Promise(r => setTimeout(r, 2000))
  }
  return { atividade: null, raw: null, erro: 'getContactWhatsApp falhou apos todas as tentativas' }
}

async function verificarPendente(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const anterior = await obterResultado(botId)
  if (!anterior?.pendente) return

  const pos = await obterAtividadeContato(config.contactId)

  if (!pos.atividade) {
    console.error(TAG, `verificarPendente ${botId}: falha ao obter atividade —`, pos.erro)
    await salvarResultado({
      ...anterior,
      status: 'erro',
      pendente: false,
      preTriggerTimestamp: undefined,
      triggeredAt: undefined,
      erro: pos.erro ?? 'sem atividade do contato',
      ultimoTesteOkMs: anterior.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: anterior.ultimoTriggerOkMs ?? undefined,
    })
    return
  }

  const temNovaAtividade = pos.atividade !== anterior.preTriggerTimestamp
  const status: BotTestStatus = temNovaAtividade ? 'ok' : 'sem_resposta'

  console.log(TAG, `verificarPendente ${botId}: pre=${anterior.preTriggerTimestamp} pos=${pos.atividade} nova=${temNovaAtividade} -> ${status}`)

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
  const pre = await obterAtividadeContato(config.contactId)

  if (!pre.atividade) {
    console.error(TAG, `iniciarNovoCiclo ${botId}: falha ao obter atividade —`, pre.erro)
    const existente = await obterResultado(botId)
    await salvarResultado({
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: pre.erro ?? 'sem atividade do contato',
      ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
    })
    return
  }

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
    preTriggerTimestamp: pre.atividade,
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
    const pre = await obterAtividadeContato(config.contactId)

    if (!pre.atividade) {
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: pre.erro ?? 'sem atividade do contato',
      }
      await salvarResultado(resultado)
      return resultado
    }

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
      preTriggerTimestamp: pre.atividade,
      triggeredAt: nowISO(),
      ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: Date.now(),
    })

    await new Promise(resolve => setTimeout(resolve, 55_000))

    const pos = await obterAtividadeContato(config.contactId)

    if (!pos.atividade) {
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: pos.erro ?? 'sem atividade do contato (pos)',
        ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
        ultimoTriggerOkMs: Date.now(),
      }
      await salvarResultado(resultado)
      return resultado
    }

    const temNovaAtividade = pos.atividade !== pre.atividade
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
