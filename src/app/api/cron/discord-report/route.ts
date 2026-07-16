import { NextResponse } from 'next/server'
import { REST, Routes } from 'discord.js'
import { listarNumeros, listarFluxos } from '@/lib/integrações/sendpulse'
import { embedRelatorio } from '@/lib/discord/embeds'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.DISCORD_BOT_TOKEN
  const applicationId = process.env.DISCORD_CLIENT_ID
  const channelId = process.env.DISCORD_REPORT_CHANNEL_ID

  if (!token || !applicationId || !channelId) {
    return NextResponse.json(
      { erro: 'Variáveis de ambiente do Discord não configuradas' },
      { status: 500 }
    )
  }

  try {
    const numeros = await listarNumeros(AbortSignal.timeout(15_000))
    const fluxosPorBot = new Map()

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

    const rest = new REST({ version: '10' }).setToken(token)

    await rest.post(Routes.channelMessages(channelId), {
      body: {
        embeds: [embed.toJSON()],
      },
    })

    return NextResponse.json({
      ok: true,
      bots: numeros.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { erro: (err as Error).message },
      { status: 500 }
    )
  }
}
