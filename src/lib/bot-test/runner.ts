import { CONTACT_MAP } from './contact-map'
import { salvarResultado, obterResultado } from './store'
import { enviarMensagemDireta } from '@/lib/integrações/sendpulse'
import type { BotTestResult } from './types'

function nowISO(): string {
  return new Date().toISOString()
}

const TAG = '[bot-test]'

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

  const inicio = Date.now()

  try {
    const requestBody = {
      contact_id: config.contactId,
      bot_id: botId,
      message: { type: 'text', text: { body: 'TESTE_NUMERO' } },
    }

    const resposta = await enviarMensagemDireta({
      contactId: config.contactId,
      botId,
      texto: 'TESTE_NUMERO',
    })

    const duracaoMs = Date.now() - inicio
    const existente = await obterResultado(botId)

    if (!resposta.ok) {
      const erroMsg = `HTTP ${resposta.statusCode}: ${JSON.stringify(resposta.body).slice(0, 200)}`
      console.error(TAG, `executarCicloTeste ${botId}: falhou -`, erroMsg)
      const resultado: BotTestResult = {
        botId,
        numero: config.numero,
        nome: config.nome,
        ultimoTeste: nowISO(),
        status: 'erro',
        duracaoMs,
        erro: erroMsg,
        ultimoTesteOkMs: existente?.ultimoTesteOkMs ?? undefined,
        ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? undefined,
        requestBody,
        responseBody: resposta.body,
      }
      await salvarResultado(resultado)
      return resultado
    }

    console.log(TAG, `executarCicloTeste ${botId}: ok (${duracaoMs}ms)`)
    const resultado: BotTestResult = {
      botId,
      numero: config.numero,
      nome: config.nome,
      ultimoTeste: nowISO(),
      status: 'ok',
      duracaoMs,
      ultimoTesteOkMs: Date.now(),
      ultimoTriggerOkMs: existente?.ultimoTriggerOkMs ?? Date.now(),
      requestBody,
      responseBody: resposta.body,
    }
    await salvarResultado(resultado)
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
