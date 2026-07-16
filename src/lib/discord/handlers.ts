import type { ChatInputCommandInteraction } from 'discord.js'
import { listarNumeros, listarFluxos } from '@/lib/integrações/sendpulse'
import { executarTeste } from '@/lib/testes/runner'
import {
  embedStatusBots,
  embedFluxosBot,
  embedRelatorio,
  embedErro,
  embedSucesso,
  embedAjuda,
} from './embeds'
import type { NumeroSendpulse } from '@/types'

function findBot(numeros: NumeroSendpulse[], input: string): NumeroSendpulse | undefined {
  const lower = input.toLowerCase()
  return numeros.find(
    n =>
      n.id === input ||
      n.numero?.includes(input) ||
      n.nome?.toLowerCase().includes(lower)
  )
}

export async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply()

  try {
    const numeros = await listarNumeros(AbortSignal.timeout(15_000))
    const embed = embedStatusBots(numeros)
    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    const embed = embedErro(`Falha ao buscar status: ${(err as Error).message}`)
    await interaction.editReply({ embeds: [embed] })
  }
}

export async function handleFluxos(interaction: ChatInputCommandInteraction) {
  const botInput = interaction.options.getString('bot', true)
  await interaction.deferReply()

  try {
    const numeros = await listarNumeros(AbortSignal.timeout(15_000))
    const bot = findBot(numeros, botInput)

    if (!bot) {
      const embed = embedErro(`Bot \`${botInput}\` não encontrado. Use /status para ver os bots disponíveis.`)
      await interaction.editReply({ embeds: [embed] })
      return
    }

    const fluxos = await listarFluxos(bot.id, AbortSignal.timeout(15_000))
    const embed = embedFluxosBot(bot.nome || bot.numero || bot.id, fluxos)
    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    const embed = embedErro(`Falha ao buscar fluxos: ${(err as Error).message}`)
    await interaction.editReply({ embeds: [embed] })
  }
}

export async function handleTestar(interaction: ChatInputCommandInteraction) {
  const botInput = interaction.options.getString('bot', true)
  await interaction.deferReply()

  try {
    const numeros = await listarNumeros(AbortSignal.timeout(15_000))
    const bot = findBot(numeros, botInput)

    if (!bot) {
      const embed = embedErro(`Bot \`${botInput}\` não encontrado. Use /status para ver os bots disponíveis.`)
      await interaction.editReply({ embeds: [embed] })
      return
    }

    const resultado = await executarTeste({ botId: bot.id })

    const statusIcon = resultado.status === 'ok' ? '✅' : resultado.status === 'erro' ? '❌' : '⏳'
    const embed = embedSucesso(
      [
        `${statusIcon} **Teste executado em ${bot.nome || bot.numero}**`,
        `Status: \`${resultado.status}\``,
        `Duração: ${resultado.duracaoMs}ms`,
        resultado.erro ? `Erro: ${resultado.erro}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )

    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    const embed = embedErro(`Falha ao executar teste: ${(err as Error).message}`)
    await interaction.editReply({ embeds: [embed] })
  }
}

export async function handleRelatorio(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply()

  try {
    const numeros = await listarNumeros(AbortSignal.timeout(15_000))
    const fluxosPorBot = new Map<string, Awaited<ReturnType<typeof listarFluxos>>>()

    const fluxosPromises = numeros.map(async num => {
      try {
        const fluxos = await listarFluxos(num.id, AbortSignal.timeout(10_000))
        fluxosPorBot.set(num.id, fluxos)
      } catch {
        fluxosPorBot.set(num.id, [])
      }
    })

    await Promise.all(fluxosPromises)

    const embed = embedRelatorio(numeros, fluxosPorBot)
    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    const embed = embedErro(`Falha ao gerar relatório: ${(err as Error).message}`)
    await interaction.editReply({ embeds: [embed] })
  }
}

export async function handleAjuda(interaction: ChatInputCommandInteraction) {
  const embed = embedAjuda()
  await interaction.reply({ embeds: [embed], ephemeral: true })
}
