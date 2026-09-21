import { sendChannelMessage } from './verify'
import type { BlacksenderLead } from '@/types'

// Canal dedicado (DISCORD_BLACKSENDER_CHANNEL_ID) — se não configurado, cai no canal geral de
// relatório, mesmo princípio de gtmetrixChannelId() em src/lib/gtmetrix/config.ts.
function canalId(): string {
  return process.env.DISCORD_BLACKSENDER_CHANNEL_ID || process.env.DISCORD_REPORT_CHANNEL_ID || ''
}

async function send(embed: {
  title: string
  description?: string
  color: number
  fields?: { name: string; value: string; inline?: boolean }[]
}) {
  const channelId = canalId()
  if (!channelId) {
    console.warn('[notify-blacksender] nenhum canal do Discord configurado (DISCORD_BLACKSENDER_CHANNEL_ID / DISCORD_REPORT_CHANNEL_ID)')
    return
  }
  try {
    await sendChannelMessage(channelId, {
      embeds: [{ title: embed.title, description: embed.description, color: embed.color, fields: embed.fields, timestamp: new Date().toISOString() }],
    })
  } catch (err) {
    console.warn('[notify-blacksender] erro ao enviar:', (err as Error).message)
  }
}

function tagsTexto(tags: unknown): string {
  if (!Array.isArray(tags) || tags.length === 0) return '—'
  return tags.map((t) => `\`${t}\``).join(' ')
}

export async function notificarNovoLead(lead: BlacksenderLead) {
  await send({
    title: '🟢 Novo lead — Black Sender',
    description: `**${lead.nome || 'Sem nome'}**`,
    color: 0x22c55e,
    fields: [
      { name: 'Telefone', value: lead.telefone || '—', inline: true },
      { name: 'Tags', value: tagsTexto(lead.tags), inline: false },
    ],
  })
}

export async function notificarTagsAplicadas(lead: BlacksenderLead, tagsNovas: string[]) {
  await send({
    title: '🏷️ Tag aplicada — Black Sender',
    description: `**${lead.nome || 'Sem nome'}**`,
    color: 0x3b82f6,
    fields: [
      { name: 'Telefone', value: lead.telefone || '—', inline: true },
      { name: tagsNovas.length > 1 ? 'Tags novas' : 'Tag nova', value: tagsTexto(tagsNovas), inline: false },
      { name: 'Tags atuais', value: tagsTexto(lead.tags), inline: false },
    ],
  })
}
