import { NextResponse } from 'next/server'
import {
  gtmetrixChannelId,
  GTMETRIX_INTERVALO_HORAS,
  GTMETRIX_JANELA_INICIO,
  GTMETRIX_JANELA_FIM,
} from '@/lib/gtmetrix/config'
import { obterUrlsGtmetrix } from '@/lib/gtmetrix/paginas'
import { rodarRodadaGTmetrix } from '@/lib/gtmetrix/runner'
import { postarRodadaDiscord } from '@/lib/gtmetrix/notify'

// Polling do GTmetrix pode passar de 1 min — precisa de folga.
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  // Vercel dispara de hora em hora (UTC); a rota só roda de verdade nas horas cheias de
  // Brasília múltiplas de GTMETRIX_INTERVALO_HORAS, dentro da janela diurna. Ajustar o
  // intervalo em config.ts pra gastar mais ou menos crédito.
  const horaBrasilia = Number(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }),
  )
  if (horaBrasilia < GTMETRIX_JANELA_INICIO || horaBrasilia > GTMETRIX_JANELA_FIM) {
    console.log(`[cron-gtmetrix] Fora da janela (${horaBrasilia}h). Pulando.`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'outside_hours' })
  }
  if (horaBrasilia % GTMETRIX_INTERVALO_HORAS !== 0) {
    console.log(`[cron-gtmetrix] ${horaBrasilia}h não é múltiplo de ${GTMETRIX_INTERVALO_HORAS}h. Pulando.`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'fora_do_intervalo' })
  }

  const channelId = gtmetrixChannelId()
  if (!channelId) {
    return NextResponse.json(
      { erro: 'DISCORD_GTMETRIX_CHANNEL_ID (ou DISCORD_REPORT_CHANNEL_ID) não configurado' },
      { status: 500 },
    )
  }

  const urls = await obterUrlsGtmetrix()
  if (urls.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'lista_vazia' })
  }

  try {
    const { rodada, creditosRecusados, avisoCreditos } = await rodarRodadaGTmetrix(urls)
    await postarRodadaDiscord(channelId, rodada, { creditosRecusados, avisoCreditos })

    return NextResponse.json({
      ok: true,
      creditosRecusados,
      total: rodada.totalTestado,
      ok_count: rodada.ok.length,
      com_problema: rodada.comProblema.length,
      fora_do_ar: rodada.quebradas.length + rodada.falhasApi.length,
      creditos: `${rodada.creditosAntes} → ${rodada.creditosDepois}`,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[cron-gtmetrix]', (err as Error).message)
    return NextResponse.json({ erro: (err as Error).message }, { status: 500 })
  }
}
