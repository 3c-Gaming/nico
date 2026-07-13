import { CONTACT_MAP } from './contact-map'
import { salvarResultado, obterResultado } from './store'
import type { BotTestResult, BotTestStatus } from './types'

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:3333'

function nowISO(): string {
  return new Date().toISOString()
}

const TAG = '[bot-test]'
const PENDENTE_TIMEOUT_MS = 5 * 60 * 1000
const WAIT_FOR_RESPONSE_MS = 60_000
const POLL_INTERVAL_MS = 5_000

async function enviarTesteNumero(numero: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const res = await fetch(BRIDGE_URL + '/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: numero, text: texto }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, erro: body.error || 'Bridge retornou ' + res.status }
    }

    const body = await res.json()
    if (!body.success) {
      return { ok: false, erro: body.error || 'Bridge retornou falha' }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, erro: (err as Error).message }
  }
}

async function verificarPendente(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const anterior = await obterResultado(botId)
  if (!anterior?.pendente) return

  const preMs = anterior.preTriggerTimestamp ? new Date(anterior.preTriggerTimestamp).getTime() : 0
  const elapsed = Date.now() - preMs

  if (elapsed < PENDENTE_TIMEOUT_MS) {
    console.log(TAG, `verificarPendente ${botId}: ainda aguardando webhook (${Math.round(elapsed / 1000)}s)`)
    return
  }

  console.log(TAG, `verificarPendente ${botId}: timeout sem webhook -> sem_resposta`)
  await salvarResultado({
    ...anterior,
    status: 'sem_resposta',
    pendente: false,
    preTriggerTimestamp: undefined,
    triggeredAt: undefined,
    ultimoTriggerOkMs: anterior.ultimoTriggerOkMs ?? undefined,
  })
}

async function iniciarNovoCiclo(botId: string, config: typeof CONTACT_MAP[string]): Promise<void> {
  const preTimestamp = nowISO()

  const envio = await enviarTesteNumero(config.numero, 'TESTE_NUMERO')
  const existente = await obterResultado(botId)

  if (!envio.ok) {
    console.error(TAG, `iniciarNovoCiclo ${botId}: envio falhou -`, envio.erro)
    await salvarResultado({
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'erro',
      duracaoMs: 0,
      erro: envio.erro,
      ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
      ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
    })
    return
  }

  console.log(TAG, `iniciarNovoCiclo ${botId}: TESTE_NUMERO enviado para ${config.numero}`)

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

    const envio = await enviarTesteNumero(config.numero, 'TESTE_NUMERO')
    if (!envio.ok) {
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs: Date.now() - inicio,
        erro: envio.erro,
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

    console.log(TAG, `executarTesteManual ${botId}: aguardando resposta do bot...`)

    const deadline = Date.now() + WAIT_FOR_RESPONSE_MS
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      const atual = await obterResultado(botId)
      if (atual && !atual.pendente) {
        const resultado: BotTestResult = {
          ...atual,
          duracaoMs: Date.now() - inicio,
        }
        await salvarResultado(resultado)
        return resultado
      }
    }

    console.log(TAG, `executarTesteManual ${botId}: timeout ${WAIT_FOR_RESPONSE_MS}ms sem resposta`)
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
