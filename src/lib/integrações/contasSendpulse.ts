/** Config e resolução multi-conta da SendPulse — a SendPulse não tem conceito de
 * sub-conta acessível por uma única API key, então cada conta (ex: "Pilhado DAXX",
 * "Pilhado Prêmios") precisa das suas próprias credenciais, vindas de
 * SENDPULSE_{NN}_API_KEY / SENDPULSE_{NN}_CLIENT_ID / SENDPULSE_{NN}_CLIENT_SECRET /
 * SENDPULSE_{NN}_MCP / SENDPULSE_{NN}_NOME no .env.local. */

export interface ContaSendpulse {
  id: string
  nome: string
  apiKey: string
  clientId: string
  clientSecret: string
  mcpUrl: string
}

let contasCache: ContaSendpulse[] | null = null

export function listarContasSendpulse(): ContaSendpulse[] {
  if (contasCache) return contasCache

  const ids = new Set<string>()
  for (const key of Object.keys(process.env)) {
    const m = key.match(/^SENDPULSE_(\d{2})_API_KEY$/)
    if (m) ids.add(m[1])
  }

  const contas: ContaSendpulse[] = [...ids]
    .sort()
    .map((id) => ({
      id,
      nome: process.env[`SENDPULSE_${id}_NOME`] ?? `Conta ${id}`,
      apiKey: process.env[`SENDPULSE_${id}_API_KEY`] ?? '',
      clientId: process.env[`SENDPULSE_${id}_CLIENT_ID`] ?? '',
      clientSecret: process.env[`SENDPULSE_${id}_CLIENT_SECRET`] ?? '',
      mcpUrl: process.env[`SENDPULSE_${id}_MCP`] || 'https://mcp.sendpulse.com/mcp',
    }))
    .filter((c) => c.apiKey)

  contasCache = contas
  return contas
}

// botId -> contaId, populado a cada listarNumerosTodasContas() (REST). Permite que
// rotas que só recebem um bot_id (fluxos, status, tags via MCP) saibam qual conta usar
// sem precisar buscar todos os números de novo.
const botIdParaContaId = new Map<string, string>()

export function registrarContaDoBot(botId: string, contaId: string) {
  botIdParaContaId.set(botId, contaId)
}

/** Cai pra primeira conta configurada se o bot ainda não foi visto (cache frio). */
export function contaParaBot(botId: string): ContaSendpulse | undefined {
  const contaId = botIdParaContaId.get(botId)
  const contas = listarContasSendpulse()
  if (contaId) {
    const conta = contas.find((c) => c.id === contaId)
    if (conta) return conta
  }
  return contas[0]
}

export function apiKeyParaBot(botId: string): string {
  return contaParaBot(botId)?.apiKey ?? ''
}

/** Cada rota da API roda como uma function serverless isolada na Vercel — o cache em
 * memória de botIdParaContaId só é confiável DENTRO da mesma invocação (ex: dentro de
 * listarNumerosTodasContas -> processarBot, no mesmo request). Uma rota chamada
 * separadamente (fluxos, tags, contagem-tag, etc.) pode cair numa instância fria sem
 * esse cache populado, e chutar a conta errada silenciosamente.
 *
 * Essa função resolve isso sem depender de memória compartilhada entre functions:
 * tenta o palpite do cache primeiro (rápido quando já é conhecido) e, se der erro
 * (a SendPulse responde 400 "bot.errors.not_exist" quando o bot não é daquela conta),
 * tenta as outras contas configuradas em sequência — sempre acerta, mesmo a frio. */
export async function comContaDoBot<T>(
  botId: string,
  fn: (apiKey: string) => Promise<T>,
): Promise<T> {
  const contas = listarContasSendpulse()
  const palpite = contaParaBot(botId)
  const ordem = palpite ? [palpite, ...contas.filter((c) => c.id !== palpite.id)] : contas

  let ultimoErro: unknown
  for (const conta of ordem) {
    try {
      const valor = await fn(conta.apiKey)
      registrarContaDoBot(botId, conta.id)
      return valor
    } catch (err) {
      ultimoErro = err
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(`Nenhuma conta SendPulse reconheceu o bot ${botId}`)
}
