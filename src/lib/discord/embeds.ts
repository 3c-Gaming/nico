import { EmbedBuilder } from 'discord.js'
import type { NumeroSendpulse, FluxoSendpulse } from '@/types'

const COLORS = {
  success: 0x22c55e,
  error: 0xef4444,
  warning: 0xf59e0b,
  info: 0x3b82f6,
  neutral: 0x6b7280,
}

export function embedStatusBots(numeros: NumeroSendpulse[]): EmbedBuilder {
  const ativos = numeros.filter(n => n.status === 'ativo').length
  const inativos = numeros.filter(n => n.status === 'inativo').length
  const cor = ativos > 0 ? COLORS.success : COLORS.error

  const embed = new EmbedBuilder()
    .setTitle('📊 Status dos Bots WhatsApp')
    .setColor(cor)
    .setTimestamp()

  if (numeros.length === 0) {
    embed.setDescription('Nenhum bot encontrado.')
    return embed
  }

  for (const num of numeros) {
    const icone = num.status === 'ativo' ? '🟢' : '🔴'
    const valor = [
      `${icone} **${num.nome || 'Sem nome'}**`,
      `📞 \`${num.numero || 'Sem número'}\``,
      `📥 Caixa: ${num.inboxTotal} total, ${num.inboxNaoLidas} não lidas`,
    ].join('\n')

    embed.addFields({ name: '\u200B', value: valor, inline: true })
  }

  embed.setFooter({ text: `${ativos} ativo(s) · ${inativos} inativo(s) · Total: ${numeros.length}` })

  return embed
}

export function embedFluxosBot(botNome: string, fluxos: FluxoSendpulse[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🔀 Fluxos — ${botNome}`)
    .setColor(COLORS.info)
    .setTimestamp()

  if (fluxos.length === 0) {
    embed.setDescription('Nenhum fluxo encontrado para este bot.')
    return embed
  }

  for (const fluxo of fluxos) {
    const icone = fluxo.status === 'ativo' ? '🟢' : fluxo.status === 'inativo' ? '🔴' : '⚪'
    const triggers = fluxo.triggers.length > 0
      ? fluxo.triggers.map(t => `\`${t.nome}\` (${t.tipo})`).join(', ')
      : 'Sem triggers'

    embed.addFields({
      name: `${icone} ${fluxo.nome}`,
      value: `Status: **${fluxo.status}**\nTriggers: ${triggers}`,
      inline: true,
    })
  }

  embed.setFooter({ text: `Total: ${fluxos.length} fluxo(s)` })

  return embed
}

export function embedRelatorio(numeros: NumeroSendpulse[], fluxosPorBot: Map<string, FluxoSendpulse[]>): EmbedBuilder {
  const ativos = numeros.filter(n => n.status === 'ativo').length
  const inativos = numeros.filter(n => n.status === 'inativo').length
  const cor = ativos > 0 ? COLORS.success : COLORS.error

  const agora = new Date()
  const horas = agora.getHours().toString().padStart(2, '0')
  const minutos = agora.getMinutes().toString().padStart(2, '0')

  const embed = new EmbedBuilder()
    .setTitle(`📋 Relatório Geral — ${horas}:${minutos}`)
    .setColor(cor)
    .setDescription('Status consolidado de todos os bots e fluxos.')
    .setTimestamp()

  const resumo = [
    `🟢 **Ativos:** ${ativos}`,
    `🔴 **Inativos:** ${inativos}`,
    `📞 **Total de bots:** ${numeros.length}`,
  ].join(' · ')

  embed.addFields({ name: 'Resumo', value: resumo })

  for (const num of numeros) {
    const icone = num.status === 'ativo' ? '🟢' : '🔴'
    const fluxos = fluxosPorBot.get(num.id) ?? []
    const fluxosAtivos = fluxos.filter(f => f.status === 'ativo').length
    const fluxosInativos = fluxos.filter(f => f.status !== 'ativo').length

    const valor = [
      `${icone} **${num.nome || 'Sem nome'}** — \`${num.numero || '?'}\``,
      `📥 Inbox: ${num.inboxTotal} (${num.inboxNaoLidas} não lidas)`,
      `🔀 Fluxos: ${fluxosAtivos} ativo(s), ${fluxosInativos} inativo(s)`,
    ].join('\n')

    embed.addFields({ name: '\u200B', value: valor, inline: true })
  }

  embed.setFooter({ text: `Gerado automaticamente · Nico Bot` })

  return embed
}

export function embedErro(mensagem: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ Erro')
    .setDescription(mensagem)
    .setColor(COLORS.error)
    .setTimestamp()
}

export function embedSucesso(mensagem: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('✅ Sucesso')
    .setDescription(mensagem)
    .setColor(COLORS.success)
    .setTimestamp()
}

export function embedAjuda(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🤖 Nico Bot — Comandos')
    .setDescription('Comandos disponíveis no bot Discord da Nico.')
    .setColor(COLORS.info)
    .addFields(
      { name: '/status', value: 'Lista o status de todos os bots WhatsApp', inline: false },
      { name: '/fluxos `bot`', value: 'Lista os fluxos/funis de um bot específico', inline: false },
      { name: '/testar `bot`', value: 'Executa um teste manual em um bot', inline: false },
      { name: '/relatorio', value: 'Gera um relatório completo de todos os bots', inline: false },
      { name: '/ajuda', value: 'Lista todos os comandos disponíveis', inline: false },
    )
    .setFooter({ text: 'Nico Bot · 3C' })
    .setTimestamp()
}
