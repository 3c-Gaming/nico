import type { DiscordEmbed } from './embeds'
import {
  embedStatusBots,
  embedFluxosBot,
  embedRelatorio,
  embedErro,
  embedSucesso,
  embedAjuda,
  embedResultadoTeste,
  embedResumoTestes,
  embedStatusPlanosSendpulse,
  embedLeadsBlacksender,
} from './embeds'
import { sendChannelMessage } from './verify'
import { hojeBrasilISO } from '@/lib/datas'

function getOption(options: { name: string; value: string }[] | undefined, name: string): string | null {
  if (!options) return null
  const opt = options.find(o => o.name === name)
  return opt?.value ?? null
}

function findBot(numeros: { id: string; nome: string; numero: string }[], input: string) {
  const lower = input.toLowerCase()
  return numeros.find(
    n => n.id === input || n.numero?.includes(input) || n.nome?.toLowerCase().includes(lower)
  )
}

type ReplyFn = (payload: { embeds?: DiscordEmbed[]; content?: string }) => Promise<void>

export async function handleStatus(reply: ReplyFn) {
  try {
    const { listarNumerosTodasContas } = await import('@/lib/integrações/sendpulse')
    const { getPreferencias } = await import('@/lib/db/supabase')
    const [numeros, { numerosNaoMonitorados }] = await Promise.all([
      listarNumerosTodasContas(AbortSignal.timeout(30_000)),
      getPreferencias(),
    ])
    const monitorados = numeros.filter(n => !numerosNaoMonitorados.includes(n.id))
    await reply({ embeds: [embedStatusBots(monitorados)] })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao buscar status: ${(err as Error).message}`)] })
  }
}

export async function handleFluxos(reply: ReplyFn, options: { name: string; value: string }[] | undefined) {
  const botInput = getOption(options, 'bot')
  if (!botInput) {
    await reply({ embeds: [embedErro('Parâmetro `bot` é obrigatório.')] })
    return
  }

  try {
    const { listarNumerosTodasContas, listarFluxos } = await import('@/lib/integrações/sendpulse')
    const { apiKeyParaBot } = await import('@/lib/integrações/contasSendpulse')
    const numeros = await listarNumerosTodasContas(AbortSignal.timeout(30_000))
    const bot = findBot(numeros, botInput)

    if (!bot) {
      await reply({ embeds: [embedErro(`Bot \`${botInput}\` não encontrado. Use /status para ver os bots disponíveis.`)] })
      return
    }

    const fluxos = await listarFluxos(bot.id, apiKeyParaBot(bot.id), AbortSignal.timeout(30_000))
    await reply({ embeds: [embedFluxosBot(bot.nome || bot.numero || bot.id, fluxos)] })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao buscar fluxos: ${(err as Error).message}`)] })
  }
}

export async function handleTestar(reply: ReplyFn, options: { name: string; value: string }[] | undefined) {
  const botInput = getOption(options, 'bot')
  if (!botInput) {
    await reply({ embeds: [embedErro('Parâmetro `bot` é obrigatório.')] })
    return
  }

  try {
    const { executarTesteManual } = await import('@/lib/bot-test/runner')
    const { obterBots } = await import('@/lib/bot-test/bot-list')

    const bots = await obterBots()
    const botInputLower = botInput.toLowerCase()
    const config = bots.find(b => b.botId.toLowerCase().includes(botInputLower) || b.nome.toLowerCase().includes(botInputLower) || b.numero.includes(botInput))

    if (!config) {
      await reply({ embeds: [embedErro(`Bot \`${botInput}\` não encontrado. Use /status para ver os bots disponíveis.`)] })
      return
    }

    const resultado = await executarTesteManual(config.botId)
    await reply({ embeds: [embedResultadoTeste(resultado)] })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao executar teste: ${(err as Error).message}`)] })
  }
}

export async function handleTestarTodos(reply: ReplyFn, channelId?: string) {
  const inicio = Date.now()

  if (!channelId) {
    await reply({ embeds: [embedErro('channel_id não disponível para enviar resultados individuais.')] })
    return
  }

  try {
    const { obterBotsPinados } = await import('@/lib/bot-test/bot-list')
    const { executarCicloTeste } = await import('@/lib/bot-test/runner')

    const bots = await obterBotsPinados()
    if (bots.length === 0) {
      await reply({ embeds: [embedErro('Nenhum bot ativo encontrado.')] })
      return
    }

    await reply({ content: `🔍 Iniciando teste de ${bots.length} bot(s)...` })

    const resultados: Awaited<ReturnType<typeof executarCicloTeste>>[] = []

    for (const config of bots) {
      try {
        const resultado = await executarCicloTeste(config.botId)
        resultados.push(resultado)
        await sendChannelMessage(channelId, { embeds: [embedResultadoTeste(resultado)] })
      } catch (err) {
        console.error(`[discord] handleTestarTodos erro em ${config.botId}:`, (err as Error).message)
      }
    }

    await sendChannelMessage(channelId, { embeds: [embedResumoTestes(resultados, Date.now() - inicio)] })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao testar todos os bots: ${(err as Error).message}`)] })
  }
}

export async function handleGtmetrix(reply: ReplyFn, options: { name: string; value: string }[] | undefined) {
  let url = (getOption(options, 'url') || '').trim()
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`

  if (!url || !/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) {
    await reply({ embeds: [embedErro('Informe um link válido. Ex: `/gtmetrix url:https://exemplo.com.br`')] })
    return
  }

  try {
    const { testarUrlAvulsa } = await import('@/lib/gtmetrix/runner')
    await reply({ content: `🔍 Testando \`${url}\` no GTmetrix… isso leva 1–3 min.` })
    const { embed } = await testarUrlAvulsa(url)
    await reply({ content: '', embeds: [embed] })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha no teste GTmetrix: ${(err as Error).message}`)] })
  }
}

export async function handleGtmetrixLista(reply: ReplyFn, channelId?: string) {
  try {
    const { obterUrlsGtmetrix } = await import('@/lib/gtmetrix/paginas')
    const { gtmetrixChannelId } = await import('@/lib/gtmetrix/config')
    const { rodarRodadaGTmetrix } = await import('@/lib/gtmetrix/runner')
    const { postarRodadaDiscord } = await import('@/lib/gtmetrix/notify')

    const urls = await obterUrlsGtmetrix()
    if (urls.length === 0) {
      await reply({ embeds: [embedErro('A lista de páginas monitoradas está vazia. Adicione páginas em Configurações.')] })
      return
    }

    const alvo = gtmetrixChannelId() || channelId
    if (!alvo) {
      await reply({ embeds: [embedErro('Nenhum canal configurado para o resultado (DISCORD_GTMETRIX_CHANNEL_ID).')] })
      return
    }

    await reply({ content: `🔍 Rodando GTmetrix em ${urls.length} página(s)… isso leva alguns minutos.` })
    const { rodada, creditosRecusados, avisoCreditos } = await rodarRodadaGTmetrix(urls)
    await postarRodadaDiscord(alvo, rodada, { creditosRecusados, avisoCreditos })
    const semTeste = rodada.falhasApi.length > 0 ? ` · ${rodada.falhasApi.length} sem teste (GTmetrix)` : ''
    await reply({ content: `✅ Rodada concluída: ${rodada.ok.length} ok · ${rodada.comProblema.length} com problema · ${rodada.quebradas.length} fora do ar${semTeste}.` })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao rodar a lista GTmetrix: ${(err as Error).message}`)] })
  }
}

export async function handleRelatorio(reply: ReplyFn) {
  try {
    const { listarNumerosTodasContas, listarFluxos } = await import('@/lib/integrações/sendpulse')
    const { apiKeyParaBot } = await import('@/lib/integrações/contasSendpulse')
    const { getPreferencias, listarBlacksenderCanais, verificarRespostaUltimaMensagemCanal } = await import('@/lib/db/supabase')
    const [numeros, { pinnedNumeros, numerosNaoMonitorados }, canaisBS] = await Promise.all([
      listarNumerosTodasContas(AbortSignal.timeout(30_000)),
      getPreferencias(),
      listarBlacksenderCanais(),
    ])
    // Só números pinados na home entram no relatório — pinnedNumeros é compartilhado entre bots
    // SendPulse e canais Black Sender (mesmo array, ver src/app/page.tsx), por isso os dois
    // conjuntos abaixo filtram pelo mesmo pinnedNumeros.
    const ativos = numeros.filter(n => !numerosNaoMonitorados.includes(n.id) && pinnedNumeros.includes(n.id))
    const fluxosPorBot = new Map<string, Awaited<ReturnType<typeof listarFluxos>>>()

    await Promise.all(ativos.map(async num => {
      try {
        const fluxos = await listarFluxos(num.id, apiKeyParaBot(num.id), AbortSignal.timeout(10_000))
        fluxosPorBot.set(num.id, fluxos)
      } catch {
        fluxosPorBot.set(num.id, [])
      }
    }))

    // Black Sender não tem o esquema de bot-test do SendPulse (ping num contact_id de teste) — a
    // saúde combina o status "Ativo/Inativo" que a própria Black Sender expõe pro número (cai
    // quando desconecta/a Meta derruba) com se o fluxo respondeu à última mensagem real recebida.
    const canaisPinados = canaisBS.filter(c => pinnedNumeros.includes(c.id))
    const canaisComSaude = await Promise.all(canaisPinados.map(async (c) => {
      const resultado = await verificarRespostaUltimaMensagemCanal(c.id).catch(() => null)
      return { nome: c.nome ?? '', telefone: c.telefone ?? '', statusOficial: c.status, respondeu: resultado?.respondeu ?? null }
    }))

    await reply({ embeds: [embedRelatorio(ativos, fluxosPorBot, canaisComSaude)] })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao gerar relatório: ${(err as Error).message}`)] })
  }
}

export async function handleAjuda(reply: ReplyFn) {
  await reply({ embeds: [embedAjuda()] })
}

export async function handleFatura(reply: ReplyFn) {
  try {
    const { buscarStatusPlanoTodasContas } = await import('@/lib/integrações/sendpulse')
    const planos = await buscarStatusPlanoTodasContas(AbortSignal.timeout(15_000))
    await reply({ embeds: [embedStatusPlanosSendpulse(planos)] })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao buscar faturas: ${(err as Error).message}`)] })
  }
}

/** Aceita "DD/MM" ou "DD/MM/AAAA" (ano de 2 ou 4 dígitos) — formato livre digitado no Discord,
 * não o seletor de data de um form. null de volta é "não informado" (default hoje); undefined
 * (nunca devolvido) não existe aqui — string vazia/não reconhecida é erro explícito, não default. */
function parseDataBR(input: string | null): string | null {
  if (!input || !input.trim()) return hojeBrasilISO()
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return null
  const dia = m[1].padStart(2, '0')
  const mes = m[2].padStart(2, '0')
  let ano = m[3] ?? String(new Date().getFullYear())
  if (ano.length === 2) ano = `20${ano}`
  const iso = `${ano}-${mes}-${dia}`
  const data = new Date(`${iso}T12:00:00`)
  if (isNaN(data.getTime()) || data.getUTCDate() !== Number(dia)) return null
  return iso
}

/** /leads alvo:<funil ou número> [data] — quantos leads um funil ou número Black Sender teve num
 * dia. `alvo` casa primeiro contra funis configurados (FlowTagConfig.funil/flowId); se não achar,
 * tenta como número (nome ou telefone do canal). "Total de Entradas no Número" soma o total de
 * leads do dia de TODOS os funis Black Sender que rodam no mesmo canal (ver canalDoFluxo) — no
 * caso de consulta por número, essa soma pode contar a mesma pessoa duas vezes se ela tiver
 * entrado em mais de um funil daquele número no mesmo dia (aproximação aceita pelo pedido
 * original: "soma das tags de entrada de todos os funis vinculados a esse número"). */
export async function handleLeads(reply: ReplyFn, options: { name: string; value: string }[] | undefined) {
  const alvoInput = getOption(options, 'alvo')
  if (!alvoInput) {
    await reply({ embeds: [embedErro('Parâmetro `alvo` é obrigatório — nome do funil ou do número.')] })
    return
  }
  const data = parseDataBR(getOption(options, 'data'))
  if (!data) {
    await reply({ embeds: [embedErro('Data inválida. Use o formato `DD/MM` ou `DD/MM/AAAA`.')] })
    return
  }

  try {
    const {
      listarFlowTagConfigs,
      listarBlacksenderCanais,
      listarBlacksenderFlowRuns,
      listarBlacksenderLeadsNovosDoFlowNoDia,
    } = await import('@/lib/db/supabase')
    const { calcularEstagiosTag, canalDoFluxo } = await import('@/lib/blacksender/jornada')

    const configs = (await listarFlowTagConfigs()).filter((c) => c.origem === 'blacksender')
    const alvoLower = alvoInput.toLowerCase()
    const cfgAlvo = configs.find((c) => c.flowId === alvoInput || (c.funil ?? '').toLowerCase().includes(alvoLower))

    if (cfgAlvo) {
      const [leadsNovos, execucoes] = await Promise.all([
        listarBlacksenderLeadsNovosDoFlowNoDia(cfgAlvo.flowId, data),
        listarBlacksenderFlowRuns(cfgAlvo.flowId),
      ])
      const idsDoDia = new Set(leadsNovos.map((l) => l.id))
      const estagios = calcularEstagiosTag(execucoes, idsDoDia)
      const ultimoLeadEm = leadsNovos.reduce<string | null>(
        (max, l) => (l.criadoEmOrigem && (!max || l.criadoEmOrigem > max) ? l.criadoEmOrigem : max), null,
      )
      const canal = canalDoFluxo(execucoes)

      let totalEntradas = leadsNovos.length
      if (canal) {
        const outrosDoCanal = await Promise.all(
          configs.filter((c) => c.flowId !== cfgAlvo.flowId).map(async (c) => ({
            c, canal: canalDoFluxo(await listarBlacksenderFlowRuns(c.flowId)),
          })),
        )
        const irmaos = outrosDoCanal.filter((x) => x.canal === canal).map((x) => x.c)
        const contagens = await Promise.all(irmaos.map((c) => listarBlacksenderLeadsNovosDoFlowNoDia(c.flowId, data)))
        totalEntradas += contagens.reduce((soma, arr) => soma + arr.length, 0)
      }

      await reply({
        embeds: [embedLeadsBlacksender({
          nome: cfgAlvo.funil || cfgAlvo.flowId,
          tipo: 'funil',
          data,
          totalLeads: leadsNovos.length,
          estagios,
          ultimoLeadEm,
          totalEntradasNoNumero: totalEntradas,
        })],
      })
      return
    }

    const canais = await listarBlacksenderCanais()
    const soDigitos = alvoInput.replace(/\D/g, '')
    const canalAlvo = canais.find((c) =>
      (c.nome ?? '').toLowerCase().includes(alvoLower) || (!!soDigitos && (c.telefone ?? '').replace(/\D/g, '').includes(soDigitos)),
    )

    if (!canalAlvo) {
      await reply({ embeds: [embedErro(`Não encontrei nenhum funil ou número Black Sender chamado \`${alvoInput}\`.`)] })
      return
    }

    const configsComCanal = await Promise.all(
      configs.map(async (c) => ({ c, execucoes: await listarBlacksenderFlowRuns(c.flowId) })),
    )
    const doNumero = configsComCanal.filter((x) => canalDoFluxo(x.execucoes) === canalAlvo.id)
    const nomeCanal = canalAlvo.nome || canalAlvo.telefone || canalAlvo.id

    if (doNumero.length === 0) {
      await reply({
        embeds: [embedLeadsBlacksender({ nome: nomeCanal, tipo: 'numero', data, totalLeads: 0, estagios: [], ultimoLeadEm: null, totalEntradasNoNumero: 0 })],
      })
      return
    }

    const leadsPorFuncao = await Promise.all(doNumero.map((x) => listarBlacksenderLeadsNovosDoFlowNoDia(x.c.flowId, data)))
    const todosLeadsIds = new Set<string>()
    let ultimoLeadEm: string | null = null
    for (const arr of leadsPorFuncao) {
      for (const l of arr) {
        todosLeadsIds.add(l.id)
        if (l.criadoEmOrigem && (!ultimoLeadEm || l.criadoEmOrigem > ultimoLeadEm)) ultimoLeadEm = l.criadoEmOrigem
      }
    }
    const estagiosPorTag = new Map<string, number>()
    doNumero.forEach((x, i) => {
      const idsDoDia = new Set(leadsPorFuncao[i].map((l) => l.id))
      for (const est of calcularEstagiosTag(x.execucoes, idsDoDia)) {
        estagiosPorTag.set(est.tag, (estagiosPorTag.get(est.tag) ?? 0) + est.contagem)
      }
    })
    const estagios = [...estagiosPorTag.entries()].map(([tag, contagem]) => ({ tag, contagem })).sort((a, b) => b.contagem - a.contagem)
    const somaBrutaEntradas = leadsPorFuncao.reduce((soma, arr) => soma + arr.length, 0)

    await reply({
      embeds: [embedLeadsBlacksender({
        nome: nomeCanal,
        tipo: 'numero',
        data,
        totalLeads: todosLeadsIds.size,
        estagios,
        ultimoLeadEm,
        totalEntradasNoNumero: somaBrutaEntradas,
      })],
    })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao buscar leads: ${(err as Error).message}`)] })
  }
}

export function dispatchCommand(
  name: string,
  options: { name: string; value: string }[] | undefined,
  reply: ReplyFn,
  channelId?: string
): Promise<void> {
  return (async () => {
    try {
      switch (name) {
        case 'status':
          return await handleStatus(reply)
        case 'fluxos':
          return await handleFluxos(reply, options)
        case 'testar':
          return await handleTestar(reply, options)
        case 'testartodos':
          return await handleTestarTodos(reply, channelId)
        case 'gtmetrix':
          return await handleGtmetrix(reply, options)
        case 'gtmetrix-lista':
          return await handleGtmetrixLista(reply, channelId)
        case 'relatorio':
          return await handleRelatorio(reply)
        case 'ajuda':
          return await handleAjuda(reply)
        case 'fatura':
          return await handleFatura(reply)
        case 'leads':
          return await handleLeads(reply, options)
        default:
          return await reply({ embeds: [embedErro(`Comando desconhecido: \`${name}\``)] })
      }
    } catch (err) {
      console.error(`[discord] dispatchCommand "${name}" failed:`, (err as Error).message)
      try { await reply({ embeds: [embedErro(`Erro interno ao executar \`${name}\`. ${(err as Error).message}`)] }) } catch {}
    }
  })()
}
