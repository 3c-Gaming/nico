import { NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/discord/verify'
import { montarRelatorioNumeros, montarRelatoriosFunisPinados } from '@/lib/discord/relatorios'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const agora = new Date()
  const horaBrasilia = Number(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  if (horaBrasilia < 6 || horaBrasilia >= 23) {
    console.log(`[cron-report] Fora do horário (${horaBrasilia}h). Pulando.`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'outside_hours' })
  }

  const channelId = process.env.DISCORD_REPORT_CHANNEL_ID
  if (!channelId) {
    return NextResponse.json(
      { erro: 'DISCORD_REPORT_CHANNEL_ID não configurado' },
      { status: 500 }
    )
  }

  try {
    // Dois relatórios por rodada, num único post: números pinados (SendPulse + Black Sender) e um
    // embed por funil Black Sender pinado — nada de avisar lead a lead/tag a tag em tempo real
    // (removido do webhook, ver src/app/api/webhooks/blacksender/route.ts), só esse resumo horário.
    const [numerosEmbed, funisEmbeds] = await Promise.all([
      montarRelatorioNumeros(),
      montarRelatoriosFunisPinados(),
    ])
    await sendChannelMessage(channelId, { embeds: [numerosEmbed, ...funisEmbeds] })

    return NextResponse.json({
      ok: true,
      funis: funisEmbeds.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ erro: (err as Error).message }, { status: 500 })
  }
}
