export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string
}

export function embedStatusBots(numeros: { id: string; nome: string; numero: string; status: string; inboxTotal: number; inboxNaoLidas: number }[]): DiscordEmbed {
  const ativos = numeros.filter(n => n.status === 'ativo').length
  const inativos = numeros.filter(n => n.status === 'inativo').length

  const embed: DiscordEmbed = {
    title: '📊 Status dos Bots WhatsApp',
    color: ativos > 0 ? 0x22c55e : 0xef4444,
    timestamp: new Date().toISOString(),
    fields: [],
    footer: { text: `${ativos} ativo(s) · ${inativos} inativo(s) · Total: ${numeros.length}` },
  }

  if (numeros.length === 0) {
    embed.description = 'Nenhum bot encontrado.'
    return embed
  }

  for (const num of numeros) {
    const icone = num.status === 'ativo' ? '🟢' : '🔴'
    embed.fields!.push({
      name: '\u200B',
      value: [
        `${icone} **${num.nome || 'Sem nome'}**`,
        `📞 \`${num.numero || 'Sem número'}\``,
        `📥 Caixa: ${num.inboxTotal} total, ${num.inboxNaoLidas} não lidas`,
      ].join('\n'),
      inline: true,
    })
  }

  return embed
}

export function embedFluxosBot(botNome: string, fluxos: { id: string; nome: string; status: string; triggers: { id: string; nome: string; tipo: number }[] }[]): DiscordEmbed {
  const embed: DiscordEmbed = {
    title: `🔀 Fluxos — ${botNome}`,
    color: 0x3b82f6,
    timestamp: new Date().toISOString(),
    fields: [],
    footer: { text: `Total: ${fluxos.length} fluxo(s)` },
  }

  if (fluxos.length === 0) {
    embed.description = 'Nenhum fluxo encontrado para este bot.'
    return embed
  }

  for (const fluxo of fluxos) {
    const icone = fluxo.status === 'ativo' ? '🟢' : fluxo.status === 'inativo' ? '🔴' : '⚪'
    const triggers = fluxo.triggers.length > 0
      ? fluxo.triggers.map(t => `\`${t.nome}\` (${t.tipo})`).join(', ')
      : 'Sem triggers'

    embed.fields!.push({
      name: `${icone} ${fluxo.nome}`,
      value: `Status: **${fluxo.status}**\nTriggers: ${triggers}`,
      inline: true,
    })
  }

  return embed
}

export function embedRelatorio(numeros: { id: string; nome: string; numero: string; status: string; inboxTotal: number; inboxNaoLidas: number }[], fluxosPorBot: Map<string, { id: string; nome: string; status: string; triggers: { id: string; nome: string; tipo: number }[] }[]>): DiscordEmbed {
  const ativos = numeros.filter(n => n.status === 'ativo').length
  const inativos = numeros.filter(n => n.status === 'inativo').length
  const agora = new Date()
  const horas = agora.getHours().toString().padStart(2, '0')
  const minutos = agora.getMinutes().toString().padStart(2, '0')

  const embed: DiscordEmbed = {
    title: `📋 Relatório Geral — ${horas}:${minutos}`,
    color: ativos > 0 ? 0x22c55e : 0xef4444,
    description: 'Status consolidado de todos os bots e fluxos.',
    timestamp: agora.toISOString(),
    fields: [
      {
        name: 'Resumo',
        value: `🟢 **Ativos:** ${ativos} · 🔴 **Inativos:** ${inativos} · 📞 **Total:** ${numeros.length}`,
      },
    ],
    footer: { text: 'Gerado automaticamente · Nico Bot' },
  }

  for (const num of numeros) {
    const icone = num.status === 'ativo' ? '🟢' : '🔴'
    const fluxos = fluxosPorBot.get(num.id) ?? []
    const fluxosAtivos = fluxos.filter(f => f.status === 'ativo').length
    const fluxosInativos = fluxos.filter(f => f.status !== 'ativo').length

    embed.fields!.push({
      name: '\u200B',
      value: [
        `${icone} **${num.nome || 'Sem nome'}** — \`${num.numero || '?'}\``,
        `📥 Inbox: ${num.inboxTotal} (${num.inboxNaoLidas} não lidas)`,
        `🔀 Fluxos: ${fluxosAtivos} ativo(s), ${fluxosInativos} inativo(s)`,
      ].join('\n'),
      inline: true,
    })
  }

  return embed
}

export function embedErro(mensagem: string): DiscordEmbed {
  return {
    title: '❌ Erro',
    description: mensagem,
    color: 0xef4444,
    timestamp: new Date().toISOString(),
  }
}

export function embedSucesso(mensagem: string): DiscordEmbed {
  return {
    title: '✅ Sucesso',
    description: mensagem,
    color: 0x22c55e,
    timestamp: new Date().toISOString(),
  }
}

export function embedAjuda(): DiscordEmbed {
  return {
    title: '🤖 Nico Bot — Comandos',
    description: 'Comandos disponíveis no bot Discord da Nico.',
    color: 0x3b82f6,
    fields: [
      { name: '/status', value: 'Lista o status de todos os bots WhatsApp', inline: false },
      { name: '/fluxos `bot`', value: 'Lista os fluxos/funis de um bot específico', inline: false },
      { name: '/testar `bot`', value: 'Executa um teste manual em um bot', inline: false },
      { name: '/testartodos', value: 'Testa todos os bots ativos de uma vez', inline: false },
      { name: '/relatorio', value: 'Gera um relatório completo de todos os bots', inline: false },
      { name: '/ajuda', value: 'Lista todos os comandos disponíveis', inline: false },
    ],
    footer: { text: 'Nico Bot · 3C' },
    timestamp: new Date().toISOString(),
  }
}

export function embedResultadoTeste(resultado: { botId: string; numero: string; nome: string; status: string; duracaoMs: number; erro?: string; ultimoTesteOkMs?: number; responseBody?: unknown; requestBody?: unknown }): DiscordEmbed {
  const isOk = resultado.status === 'ok'
  const statusEmoji = isOk ? '✅' : '❌'
  const ultimoOk = resultado.ultimoTesteOkMs
    ? new Date(resultado.ultimoTesteOkMs).toLocaleString('pt-BR')
    : 'Nunca'

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Status', value: `${statusEmoji} \`${resultado.status}\``, inline: true },
    { name: 'Número', value: `\`${resultado.numero || 'N/A'}\``, inline: true },
    { name: 'Duração', value: `${resultado.duracaoMs}ms`, inline: true },
    { name: 'Último Teste OK', value: ultimoOk, inline: false },
  ]

  if (resultado.responseBody) {
    const json = JSON.stringify(resultado.responseBody, null, 2)
    const truncated = json.length > 950 ? json.slice(0, 950) + '...' : json
    fields.push({ name: 'Response', value: '```json\n' + truncated + '\n```', inline: false })
  }

  if (resultado.erro) {
    fields.push({ name: 'Erro', value: resultado.erro, inline: false })
  }

  return {
    title: `🧪 Teste: ${resultado.nome}`,
    color: isOk ? 0x22c55e : 0xef4444,
    fields,
    timestamp: new Date().toISOString(),
  }
}

export function embedResumoTestes(resultados: { botId: string; numero: string; nome: string; status: string; duracaoMs: number; erro?: string }[], duracaoTotalMs: number): DiscordEmbed {
  const total = resultados.length
  const ok = resultados.filter(r => r.status === 'ok').length
  const erros = resultados.filter(r => r.status === 'erro').length
  const semResposta = resultados.filter(r => r.status === 'sem_resposta').length
  const allOk = erros === 0 && semResposta === 0

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Total', value: `${total}`, inline: true },
    { name: '✅ Ok', value: `${ok}`, inline: true },
    { name: '❌ Erros', value: `${erros}`, inline: true },
    { name: '⏳ Sem resposta', value: `${semResposta}`, inline: true },
    { name: 'Duração total', value: `${duracaoTotalMs}ms`, inline: true },
  ]

  const falhas = resultados.filter(r => r.status === 'erro')
  if (falhas.length > 0) {
    const detalhes = falhas.map(f =>
      `❌ **${f.nome}** (\`${f.numero || '?'}\`): ${f.erro ? f.erro.slice(0, 200) : 'Erro desconhecido'}`
    ).join('\n')
    fields.push({ name: 'Detalhes dos erros', value: detalhes.length > 1000 ? detalhes.slice(0, 1000) + '...' : detalhes, inline: false })
  }

  return {
    title: `📊 Teste de Números — ${new Date().toLocaleString('pt-BR')}`,
    color: allOk ? 0x22c55e : 0xef4444,
    fields,
    timestamp: new Date().toISOString(),
  }
}
