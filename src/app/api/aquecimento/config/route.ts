import { NextRequest, NextResponse } from 'next/server'
import { requireSupabase, obterAquecimentoConfig, configFromRow } from '@/lib/aquecimento/db'

export async function GET() {
  try {
    const config = await obterAquecimentoConfig()
    return NextResponse.json({ config })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  if (body.janelaInicioHora !== undefined) update.janela_inicio_hora = body.janelaInicioHora
  if (body.janelaFimHora !== undefined) update.janela_fim_hora = body.janelaFimHora
  if (body.cronPaused !== undefined) update.cron_paused = body.cronPaused
  if (body.rampa !== undefined) update.rampa = body.rampa
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'nada pra atualizar' }, { status: 400 })

  try {
    const { data, error } = await requireSupabase().from('aquecimento_config').update(update).eq('id', 1).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ config: configFromRow(data) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
