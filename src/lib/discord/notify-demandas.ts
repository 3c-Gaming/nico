import { sendChannelMessage } from './verify'
import type { Demanda, UsuarioResponsavel } from '@/types'

const CHANNEL_ID = process.env.DISCORD_REPORT_CHANNEL_ID ?? ''

const TITULO_COLUNA: Record<string, string> = {
  ideias: 'Na Fila',
  fazendo: 'Fazendo',
  revisao: 'Revisão',
  concluido: 'Concluído',
}

function corDaColuna(coluna: string): number {
  const cores: Record<string, number> = {
    ideias: 0x6b7280,
    fazendo: 0x3b82f6,
    revisao: 0xf59e0b,
    concluido: 0x10b981,
  }
  return cores[coluna] ?? 0x6b7280
}

function responsavelTexto(responsavel?: UsuarioResponsavel): string {
  if (!responsavel) return ''
  const mention = responsavel.discordId ? ` <@${responsavel.discordId}>` : ''
  return `**Responsavel:** ${responsavel.nome}${mention}`
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

async function send(embed: {
  title: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
}) {
  if (!CHANNEL_ID) {
    console.warn('[notify-demandas] DISCORD_REPORT_CHANNEL_ID não configurado')
    return
  }
  try {
    await sendChannelMessage(CHANNEL_ID, {
      embeds: [
        {
          title: embed.title,
          description: embed.description,
          color: embed.color ?? 0x6b7280,
          fields: embed.fields,
          timestamp: new Date().toISOString(),
        },
      ],
    })
  } catch (err) {
    console.warn('[notify-demandas] erro ao enviar:', (err as Error).message)
  }
}

export async function notificarCriacao(demanda: Demanda, responsavel?: UsuarioResponsavel) {
  await send({
    title: `📋 Nova demanda`,
    description: `**${demanda.titulo}**`,
    color: 0x3b82f6,
    fields: [
      { name: 'Coluna', value: TITULO_COLUNA[demanda.coluna] ?? demanda.coluna, inline: true },
      { name: 'Prioridade', value: demanda.prioridade ?? 'media', inline: true },
      ...(responsavel ? [{ name: 'Responsavel', value: responsavelTexto(responsavel), inline: false }] : []),
      ...(demanda.descricao ? [{ name: 'Descricao', value: truncate(demanda.descricao, 200), inline: false }] : []),
    ],
  })
}

export async function notificarMovimento(
  demanda: Demanda,
  colunaAntiga: string,
  colunaNova: string,
  responsavel?: UsuarioResponsavel
) {
  await send({
    title: `↔️ Demanda movida`,
    description: `**${demanda.titulo}**`,
    color: corDaColuna(colunaNova),
    fields: [
      { name: 'De', value: TITULO_COLUNA[colunaAntiga] ?? colunaAntiga, inline: true },
      { name: 'Para', value: TITULO_COLUNA[colunaNova] ?? colunaNova, inline: true },
      ...(responsavel ? [{ name: 'Responsavel', value: responsavelTexto(responsavel), inline: false }] : []),
    ],
  })
}

export async function notificarEdicaoDescricao(demanda: Demanda, descricaoAntiga: string, responsavel?: UsuarioResponsavel) {
  await send({
    title: `✏️ Descricao atualizada`,
    description: `**${demanda.titulo}**`,
    color: 0xf59e0b,
    fields: [
      ...(descricaoAntiga ? [{ name: 'Antiga', value: truncate(descricaoAntiga, 200), inline: false }] : []),
      { name: 'Nova', value: truncate(demanda.descricao ?? '(vazia)', 200), inline: false },
      ...(responsavel ? [{ name: 'Responsavel', value: responsavelTexto(responsavel), inline: false }] : []),
    ],
  })
}

export async function notificarFinalizacao(demanda: Demanda, responsavel?: UsuarioResponsavel) {
  await send({
    title: `✅ Demanda concluida`,
    description: `**${demanda.titulo}**`,
    color: 0x10b981,
    fields: [
      ...(responsavel ? [{ name: 'Responsavel', value: responsavelTexto(responsavel), inline: false }] : []),
      ...(demanda.descricao ? [{ name: 'Descricao', value: truncate(demanda.descricao, 200), inline: false }] : []),
    ],
  })
}

export async function notificarExclusao(demanda: Demanda, responsavel?: UsuarioResponsavel) {
  await send({
    title: `🗑️ Demanda excluida`,
    description: `**${demanda.titulo}**`,
    color: 0xef4444,
    fields: [
      { name: 'Coluna', value: TITULO_COLUNA[demanda.coluna] ?? demanda.coluna, inline: true },
      { name: 'Prioridade', value: demanda.prioridade ?? 'media', inline: true },
      ...(responsavel ? [{ name: 'Responsavel', value: responsavelTexto(responsavel), inline: false }] : []),
    ],
  })
}
