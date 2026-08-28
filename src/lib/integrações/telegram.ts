// Disparo de Telegram via CSV — duas APIs diferentes, cada uma com um papel:
//   - SendPulse: só pra descobrir o telegram_id (chat_id numérico) de cada @username. A SendPulse
//     já tem isso guardado pra todo contato que já falou com o bot (channel_data), mesmo sem
//     aparecer no CSV que a gente recebe.
//   - Telegram Bot API direto: pra mandar a mensagem de verdade (sendMessage), com o token do bot
//     (mesmo bot, TELEGRAM_BOT_TOKEN) — não pela SendPulse, pra não depender de limite de
//     "campanha" que a plataforma deles possa impor em cima de disparo em massa.
//
// Diferença importante pro SMS: aqui não existe callback assíncrono de entrega — sendMessage
// responde na hora se foi aceito ou não pelo Telegram. Sem status "queued"/"delivered"; só
// sucesso ou erro, direto na primeira chamada.

const TELEGRAM_API_BASE = 'https://api.telegram.org'
const SENDPULSE_API_BASE = 'https://api.sendpulse.com/telegram'

export interface ContatoTelegramResolvido {
  telegramId: number
  contactId: string
  nome: string
}

const TAMANHO_PAGINA_CONTATOS = 100

/** Pagina todos os contatos do bot na SendPulse e monta um índice username (lowercase, sem @) ->
 * telegram_id/contact_id. Contato sem username público no Telegram não entra no índice — não tem
 * como casar esse pelo CSV (limitação de privacidade do próprio usuário, não nossa). Chamado uma
 * vez por disparo (não por request de UI) — pra ~4 mil contatos são ~40 páginas, alguns segundos. */
export async function buscarIndiceContatosPorUsername(botId: string, apiKey: string): Promise<Map<string, ContatoTelegramResolvido>> {
  const indice = new Map<string, ContatoTelegramResolvido>()
  let skip = 0

  // `offset` é ignorado por esse endpoint da SendPulse (confirmado ao vivo: página 2 com offset
  // voltava idêntica à página 1) — o parâmetro certo é `skip`, mesmo usado em getByTag noutro
  // lugar do código.
  for (;;) {
    const res = await fetch(`${SENDPULSE_API_BASE}/contacts?bot_id=${encodeURIComponent(botId)}&limit=${TAMANHO_PAGINA_CONTATOS}&skip=${skip}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`SendPulse contacts error ${res.status}`)
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contatos = (json.data ?? []) as any[]

    for (const c of contatos) {
      const username = c.channel_data?.username as string | null | undefined
      const telegramId = c.telegram_id as number | undefined
      if (username && telegramId) {
        indice.set(username.toLowerCase(), { telegramId, contactId: c.id, nome: c.channel_data?.name ?? '' })
      }
    }

    if (contatos.length < TAMANHO_PAGINA_CONTATOS) break
    skip += TAMANHO_PAGINA_CONTATOS
  }

  return indice
}

/** Substitui {{variavel}} no template pelos valores — feito aqui, não pelo provider (diferente da
 * Solvefy, a API do Telegram não tem templating server-side, então o texto final já precisa
 * chegar pronto no sendMessage). */
export function renderizarTemplate(corpo: string, variables: Record<string, string> | undefined): string {
  if (!variables) return corpo
  return corpo.replace(/\{\{(\w+)\}\}/g, (match, nome) => variables[nome] ?? match)
}

export interface EnviarTelegramResultado {
  ok: boolean
  messageId?: number
  erro?: string
}

/** Manda a mensagem de verdade via Bot API. Retenta uma vez em 429 (rate limit do Telegram, que
 * informa `retry_after` em segundos) se a espera pedida for curta — acima disso, desiste e marca
 * erro (o próximo ciclo do cron tenta de novo, não trava a function esperando muito). */
export async function enviarTelegram(params: { chatId: number; texto: string; token?: string }): Promise<EnviarTelegramResultado> {
  const token = params.token ?? process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, erro: 'TELEGRAM_BOT_TOKEN não configurado' }

  const chamar = async (): Promise<Response> => fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: params.chatId, text: params.texto }),
  })

  let res = await chamar()
  if (res.status === 429) {
    const json = await res.json().catch(() => null)
    const retryAfter = json?.parameters?.retry_after ?? 0
    if (retryAfter > 0 && retryAfter <= 5) {
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
      res = await chamar()
    }
  }

  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    const erro = json?.description || `HTTP ${res.status}`
    return { ok: false, erro }
  }

  return { ok: true, messageId: json.result?.message_id }
}
