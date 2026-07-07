import type { TestRequest, TestResult } from './types'
import { salvarResultado, atualizarTeste } from './store'
import { analisarResposta } from './analyzer'
import { verificarLinks } from './scraper'
import { dispararAlerta } from './alerta'

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:3001'

function generateId(): string {
  const rand = () => Math.random().toString(36).substring(2, 10)
  return 'test_' + rand() + rand()
}

export async function executarTeste(request: TestRequest): Promise<TestResult> {
  const inicio = Date.now()
  const testId = generateId()

  const resultadoBase: TestResult = {
    id: testId,
    botId: request.botId,
    status: 'pending',
    mensagemEnviada: request.mensagem || 'Olá',
    duracaoMs: 0,
    criadoEm: new Date().toISOString(),
  }

  await salvarResultado(resultadoBase)

  try {
    const numerosRes = await fetch(
      (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/sendpulse/numeros'
    )
    const numerosData = await numerosRes.json()
    const numeros = numerosData.numeros || []
    const bot = numeros.find((n: { id: string }) => n.id === request.botId)
    if (!bot) throw new Error('Bot nao encontrado: ' + request.botId)

    const numeroTelefone = String(bot.numero).replace(/\D/g, '')

    await atualizarTeste(testId, { status: 'aguardando_resposta' })

    const bridgeRes = await fetch(BRIDGE_URL + '/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '55' + numeroTelefone,
        text: request.mensagem || 'Olá',
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!bridgeRes.ok) {
      throw new Error('Bridge retornou erro: ' + bridgeRes.status)
    }

    const resultado: TestResult = {
      ...resultadoBase,
      status: 'sem_resposta',
      duracaoMs: Date.now() - inicio,
    }

    await atualizarTeste(testId, resultado)
    await dispararAlerta(resultado)
    return resultado
  } catch (err) {
    const resultado: TestResult = {
      ...resultadoBase,
      status: 'erro',
      duracaoMs: Date.now() - inicio,
      erro: (err as Error).message,
    }
    await atualizarTeste(testId, resultado)
    await dispararAlerta(resultado)
    return resultado
  }
}

export async function processarRespostaWhatsApp(
  from: string,
  text: string,
  messageId: string
): Promise<TestResult | null> {
  const { buscarTestePendente, atualizarTeste } = await import('./store')

  const teste = await buscarTestePendente(from)
  if (!teste) return null

  const duracaoMs = Date.now() - new Date(teste.criadoEm).getTime()

  const analise = await analisarResposta(text, { botId: teste.botId }, duracaoMs)

  const resultado: TestResult = {
    ...teste,
    ...analise,
    duracaoMs,
  }

  if (resultado.linksEncontrados && resultado.linksEncontrados.length > 0) {
    const linksVerificados = await verificarLinks(resultado.linksEncontrados)
    resultado.linksVerificados = linksVerificados

    const temLinkQuebrado = linksVerificados.some(
      (l) => l.statusCode === undefined || l.statusCode >= 400
    )
    if (temLinkQuebrado && resultado.status === 'ok') {
      resultado.status = 'link_quebrado'
    }
  }

  await atualizarTeste(teste.id, resultado)
  await dispararAlerta(resultado)

  return resultado
}
