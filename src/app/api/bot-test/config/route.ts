import { NextResponse } from 'next/server'
import { carregarConfig, salvarConfig } from '@/lib/bot-test/store'
import { reiniciarCron } from '@/lib/bot-test/cron'
import type { BotTestConfig } from '@/lib/bot-test/types'

export async function GET() {
  try {
    const config = await carregarConfig()
    return NextResponse.json({ config })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { pollIntervalMs } = body

    const novaConfig: BotTestConfig = {
      pollIntervalMs:
        typeof pollIntervalMs === 'number' && pollIntervalMs >= 10_000
          ? pollIntervalMs
          : 900_000,
    }

    await salvarConfig(novaConfig)
    await reiniciarCron()

    return NextResponse.json({ config: novaConfig })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
