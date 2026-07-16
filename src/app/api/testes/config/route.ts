import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'
import { obterBots } from '@/lib/bot-test/bot-list'

function supabase() {
  const s = getSupabase()
  if (!s) throw new Error('Supabase não disponível')
  return s as any
}

interface CronConfig {
  pollIntervalMs: number
  cronPaused: boolean
  lastRunAt: string | null
  botContactIds: Record<string, string>
}

export async function GET() {
  try {
    const { data: configRes } = await supabase().from('bot_test_config').select('*').eq('id', 1).maybeSingle()

    let bots: { botId: string; nome: string; numero: string }[] = []
    try {
      const botList = await obterBots()
      bots = botList.map((b) => ({ botId: b.botId, nome: b.nome, numero: b.numero }))
    } catch {}

    return NextResponse.json({
      pollIntervalMs: configRes?.poll_interval_ms ?? 900_000,
      cronPaused: configRes?.cron_paused ?? false,
      lastRunAt: configRes?.last_run_at ?? null,
      botContactIds: configRes?.bot_contact_ids ?? {},
      bots,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.pollIntervalMs !== undefined) {
      const ms = Number(body.pollIntervalMs)
      if (ms < 900_000) {
        return NextResponse.json({ error: 'Intervalo mínimo: 15 minutos (900000ms)' }, { status: 400 })
      }
      update.poll_interval_ms = ms
    }

    if (body.cronPaused !== undefined) {
      update.cron_paused = Boolean(body.cronPaused)
    }

    if (body.botContactIds !== undefined) {
      update.bot_contact_ids = body.botContactIds
    }

    await supabase().from('bot_test_config').upsert({ id: 1, ...update })

    const { data: configRes } = await supabase().from('bot_test_config').select('*').eq('id', 1).maybeSingle()

    let bots: { botId: string; nome: string; numero: string }[] = []
    try {
      const botList = await obterBots()
      bots = botList.map((b) => ({ botId: b.botId, nome: b.nome, numero: b.numero }))
    } catch {}

    return NextResponse.json({
      pollIntervalMs: configRes?.poll_interval_ms ?? 900_000,
      cronPaused: configRes?.cron_paused ?? false,
      lastRunAt: configRes?.last_run_at ?? null,
      botContactIds: configRes?.bot_contact_ids ?? {},
      bots,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
