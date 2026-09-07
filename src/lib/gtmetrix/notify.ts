import { sendChannelMessage } from '@/lib/discord/verify'
import {
  embedGtProblema,
  embedGtQuebrada,
  embedGtResumo,
  embedGtChaveRecusada,
} from './embeds'
import type { DiscordEmbed } from '@/lib/discord/embeds'
import type { GtmetrixRodada } from './types'

/** Manda pro Discord tudo que interessa de uma rodada: quebradas, avisos, problemas e resumo. */
export async function postarRodadaDiscord(
  channelId: string,
  rodada: GtmetrixRodada,
  opts: { creditosRecusados?: boolean; avisoCreditos?: DiscordEmbed | null } = {},
): Promise<void> {
  const enviar = async (embed: DiscordEmbed) => {
    try {
      await sendChannelMessage(channelId, { embeds: [embed] })
    } catch (err) {
      console.error('[gtmetrix] falha ao enviar embed no Discord:', (err as Error).message)
    }
  }

  if (opts.creditosRecusados) {
    await enviar(embedGtChaveRecusada())
    return
  }

  for (const q of rodada.quebradas) {
    await enviar(embedGtQuebrada(q.url, q.motivo || `HTTP ${q.status}`))
  }
  if (opts.avisoCreditos) await enviar(opts.avisoCreditos)
  for (const f of rodada.falhasApi) {
    await enviar(embedGtQuebrada(f.url, f.motivo))
  }
  for (const p of rodada.comProblema) {
    await enviar(embedGtProblema(p.url, p.dados, p.problemas))
  }
  await enviar(embedGtResumo(rodada))
}
