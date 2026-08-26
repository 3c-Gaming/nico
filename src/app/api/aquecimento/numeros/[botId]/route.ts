import { NextRequest, NextResponse } from 'next/server'
import { requireSupabase, numeroFromRow } from '@/lib/aquecimento/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params
  const body = await request.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  if (body.status) update.status = body.status
  if (body.papel) update.papel = body.papel
  if (body.notas !== undefined) update.notas = body.notas
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'nada pra atualizar' }, { status: 400 })

  try {
    const { data, error } = await requireSupabase()
      .from('aquecimento_numeros')
      .update(update)
      .eq('bot_id', botId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ numero: numeroFromRow(data) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params
  try {
    const { error } = await requireSupabase().from('aquecimento_numeros').delete().eq('bot_id', botId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
