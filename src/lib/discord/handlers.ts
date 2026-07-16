import type { DiscordEmbed } from './embeds'
import {
  embedStatusBots,
  embedFluxosBot,
  embedRelatorio,
  embedErro,
  embedSucesso,
  embedAjuda,
} from './embeds'

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
    const statusIcon = resultado.status === 'ok' ? '✅' : resultado.status === 'erro' ? '❌' : '⏳'

    await reply({
      embeds: [embedSucesso(
        [
          `${statusIcon} **Teste executado em ${config.nome}**`,
          `Status: \`${resultado.status}\``,
          `Duração: ${resultado.duracaoMs}ms`,
          resultado.erro ? `Erro: ${resultado.erro}` : '',
        ].filter(Boolean).join('\n')
      )],
    })
  } catch (err) {
    await reply({ embeds: [embedErro(`Falha ao executar teste: ${(err as Error).message}`)] })
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
  reply: ReplyFn
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
