import { NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/discord/verify'
import { listarNumeros, listarFluxos } from '@/lib/integrações/sendpulse'
import { embedRelatorio } from '@/lib/discord/embeds'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const channelId = process.env.DISCORD_REPORT_CHANNEL_ID
  if (!channelId) {
    return NextResponse.json(
      { erro: 'DISCORD_REPORT_CHANNEL_ID não configurado' },
      { status: 500 }
    )
  }

  try {
    const numeros = await listarNumeros(AbortSignal.timeout(15_000))
    const fluxosPorBot = new Map()

    await Promise.all(numeros.map(async num => {
      try {
        const fluxos = await listarFluxos(num.id, AbortSignal.timeout(10_000))
        fluxosPorBot.set(num.id, fluxos)
      } catch {
        fluxosPorBot.set(num.id, [])
      }
    }))

    const embed = embedRelatorio(numeros, fluxosPorBot)
    await sendChannelMessage(channelId, { embeds: [embed] })

    return NextResponse.json({
      ok: true,
      bots: numeros.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ erro: (err as Error).message }, { status: 500 })
  }
}
