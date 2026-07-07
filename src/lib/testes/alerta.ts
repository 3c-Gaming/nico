import type { TestResult } from './types'

const WEBHOOKS_FILE = process.env.ALERT_WEBHOOKS
let webhooks: string[] = []

try {
  if (WEBHOOKS_FILE) {
    webhooks = JSON.parse(WEBHOOKS_FILE)
  }
} catch {}

export function configurarWebhooks(urls: string[]) {
  webhooks = urls
}

export async function dispararAlerta(resultado: TestResult) {
  if (resultado.status === 'ok') return

  const mensagem = [
    `❌ *Falha no teste QA WhatsApp*`,
    `Bot: ${resultado.botId}`,
    `Status: ${resultado.status}`,
    resultado.erro ? `Erro: ${resultado.erro}` : '',
    resultado.respostaRecebida ? `Resposta: ${resultado.respostaRecebida.slice(0, 200)}` : '',
    resultado.linksEncontrados?.length ? `Links: ${resultado.linksEncontrados.join(', ')}` : '',
    `ID: ${resultado.id}`,
  ]
    .filter(Boolean)
    .join('\n')

  for (const url of webhooks) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: mensagem }),
      })
    } catch {}
  }
}
