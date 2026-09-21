import { sendChannelMessage } from './verify'
import { embedCanalBanido } from './embeds'

/** true quando a Black Sender já marcou o número como banido/bloqueado — dois sinais possíveis
 * (metaPhoneStatus é o mais direto; healthStatus 'blocked' cobre outros bloqueios que não
 * necessariamente vêm com meta_phone_status = BANNED). O `status` "genérico" do canal (active/
 * inactive) NÃO serve pra isso — continua "active" mesmo com o número banido. */
export function canalEstaBanido(c: { metaPhoneStatus?: string | null; healthStatus?: string | null }): boolean {
  return c.metaPhoneStatus === 'BANNED' || c.healthStatus === 'blocked'
}

export async function notificarCanalBanido(canal: { nome: string | null; telefone: string | null; metaPhoneStatus: string | null; healthReason: string | null }): Promise<void> {
  const channelId = process.env.DISCORD_REPORT_CHANNEL_ID
  if (!channelId) return
  await sendChannelMessage(channelId, { embeds: [embedCanalBanido(canal)] }).catch((err) => {
    console.warn('[notify-canal-banido] falha ao notificar:', (err as Error).message)
  })
}
