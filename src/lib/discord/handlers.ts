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
} from './embeds'
import { sendChannelMessage } from './verify'

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
    const { listarNumeros } = await import('@/lib/integrações/sendpulse')
    const numeros = await listarNumeros(AbortSignal.timeout(30_000))
    await reply({ embeds: [embedStatusBots(numeros)] })
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
    const { listarNumeros, listarFluxos } = await import('@/lib/integrações/sendpulse')
    const numeros = await listarNumeros(AbortSignal.timeout(30_000))
    const bot = findBot(numeros, botInput)

    if (!bot) {
      await reply({ embeds: [embedErro(`Bot \`${botInput}\` não encontrado. Use /status para ver os bots disponíveis.`)] })
      return
    }

    const fluxos = await listarFluxos(bot.id, AbortSignal.timeout(30_000))
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

export async function handleRelatorio(reply: ReplyFn) {
  try {
    const { listarNumeros, listarFluxos } = await import('@/lib/integrações/sendpulse')
    const numeros = await listarNumeros(AbortSignal.timeout(30_000))
    const fluxosPorBot = new Map<string, Awaited<ReturnType<typeof listarFluxos>>>()

    await Promise.all(numeros.map(async num => {
      try {
        const fluxos = await listarFluxos(num.id, AbortSignal.timeout(10_000))
        fluxosPorBot.set(num.id, fluxos)
      } catch {
        fluxosPorBot.set(num.id, [])
      }
    }))

    await reply({ embeds: [embedRelatorio(numeros, fluxosPorBot)] })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao gerar relatório: ${(err as Error).message}`)] })
  }
}

export async function handleAjuda(reply: ReplyFn) {
  await reply({ embeds: [embedAjuda()] })
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
        case 'relatorio':
          return await handleRelatorio(reply)
        case 'ajuda':
          return await handleAjuda(reply)
        default:
          return await reply({ embeds: [embedErro(`Comando desconhecido: \`${name}\``)] })
      }
    } catch (err) {
      console.error(`[discord] dispatchCommand "${name}" failed:`, (err as Error).message)
      try { await reply({ embeds: [embedErro(`Erro interno ao executar \`${name}\`. ${(err as Error).message}`)] }) } catch {}
    }
  })()
}
