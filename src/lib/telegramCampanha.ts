// Lógica de disparo de Telegram via CSV — mesmo molde de smsCampanha.ts (envio imediato e cron de
// agendados chamam essa função), pra não divergir.

import { buscarIndiceContatosPorUsername, enviarTelegram, renderizarTemplate } from '@/lib/integrações/telegram'
import { resolverContaEBotTelegram } from '@/lib/integrações/sendpulse'
import { getSupabase } from '@/lib/db/supabase'

export interface DestinatarioTelegram {
  /** Opcional quando telegramId já vem pronto (base montada de tag da SendPulse) — nem todo
   * contato tem @username público no Telegram. */
  username?: string
  /** Se já vier preenchido (base montada direto de uma tag da SendPulse, não de CSV), pula a
   * busca por username inteiramente — é o caso comum de quem não tem @username público mas ainda
   * assim tem telegram_id conhecido pela SendPulse. */
  telegramId?: number
  variables?: Record<string, string>
}

export interface ResultadoEnvioTelegram {
  username: string
  ok: boolean
  erro?: string
}

export interface EnviarCampanhaTelegramParams {
  campanha: string
  corpo: string
  /** Identificador salvo no Disparo (o "numero" que listarNumeros devolve pra bots de Telegram —
   * "@username" ou id) — resolve pra apiKey/botId reais na hora de enviar. */
  botIdentificador: string
  destinatarios: DestinatarioTelegram[]
}

// Telegram tolera rajadas curtas bem acima disso, mas ~10 concorrentes por vez mantém uma margem
// folgada do limite de ~30 msg/s da API sem precisar calibrar fino.
const TAMANHO_LOTE = 10

function normalizarUsername(valor: string): string {
  return valor.trim().replace(/^@/, '').toLowerCase()
}

export async function enviarCampanhaTelegram(params: EnviarCampanhaTelegramParams): Promise<{
  total: number
  enviados: number
  falhas: number
  resultados: ResultadoEnvioTelegram[]
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  const conta = await resolverContaEBotTelegram(params.botIdentificador)
  if (!conta) throw new Error(`Bot de Telegram "${params.botIdentificador}" não encontrado em nenhuma conta SendPulse configurada`)

  // Só busca o índice de contatos (varre a base inteira do bot) se algum destinatário realmente
  // precisar — vindo de tag da SendPulse, o telegram_id já chega pronto e essa varredura inteira
  // é desnecessária.
  const precisaIndice = params.destinatarios.some((d) => !d.telegramId)
  const indice = precisaIndice ? await buscarIndiceContatosPorUsername(conta.botId, conta.apiKey) : null
  const resultados: ResultadoEnvioTelegram[] = []

  for (let i = 0; i < params.destinatarios.length; i += TAMANHO_LOTE) {
    const lote = params.destinatarios.slice(i, i + TAMANHO_LOTE)
    const loteResolvido = await Promise.all(
      lote.map(async (dest) => {
        const username = dest.username ? normalizarUsername(dest.username) : null
        const telegramId = dest.telegramId ?? (username ? indice?.get(username)?.telegramId : undefined)

        if (!telegramId) {
          if (supabase) {
            await supabase.from('telegram_envios').insert({
              campanha: params.campanha,
              username,
              telegram_id: null,
              status: 'erro',
              erro: 'username não encontrado nos contatos do bot (sem @username público no Telegram, ou nunca falou com o bot)',
            })
          }
          return { username: username ?? '(sem username)', ok: false, erro: 'não encontrado' } as ResultadoEnvioTelegram
        }

        const texto = renderizarTemplate(params.corpo, dest.variables)
        const resultado = await enviarTelegram({ chatId: telegramId, texto })

        if (supabase) {
          await supabase.from('telegram_envios').insert({
            campanha: params.campanha,
            username,
            telegram_id: telegramId,
            status: resultado.ok ? 'enviado' : 'erro',
            erro: resultado.ok ? null : resultado.erro,
          })
        }

        return { username: username ?? `#${telegramId}`, ok: resultado.ok, erro: resultado.erro } as ResultadoEnvioTelegram
      }),
    )
    resultados.push(...loteResolvido)
  }

  const enviados = resultados.filter((r) => r.ok).length
  return { total: resultados.length, enviados, falhas: resultados.length - enviados, resultados }
}
