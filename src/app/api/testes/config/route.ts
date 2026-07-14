import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

function supabase() {
  const s = getSupabase()
  if (!s) throw new Error('Supabase não disponível')
  return s as any
}

interface CronConfig {
  pollIntervalMs: number
  cronPaused: boolean
  lastRunAt: string | null
}

export async function GET() {
  try {
    const { data } = await supabase().from('bot_test_config').select('*').eq('id', 1).maybeSingle()
    const config: CronConfig = {
      pollIntervalMs: data?.poll_interval_ms ?? 900_000,
      cronPaused: data?.cron_paused ?? false,
      lastRunAt: data?.last_run_at ?? null,
    }
    return NextResponse.json(config)
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

    await supabase().from('bot_test_config').upsert({ id: 1, ...update })

    const { data } = await supabase().from('bot_test_config').select('*').eq('id', 1).maybeSingle()
    return NextResponse.json({
      pollIntervalMs: data?.poll_interval_ms ?? 900_000,
      cronPaused: data?.cron_paused ?? false,
      lastRunAt: data?.last_run_at ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
