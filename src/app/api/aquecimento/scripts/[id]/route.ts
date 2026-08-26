import { NextRequest, NextResponse } from 'next/server'
import { requireSupabase, scriptFromRow } from '@/lib/aquecimento/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  if (body.nome !== undefined) update.nome = body.nome
  if (body.tema !== undefined) update.tema = body.tema
  if (body.mensagens !== undefined) update.mensagens = body.mensagens
  if (body.ativo !== undefined) update.ativo = body.ativo
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'nada pra atualizar' }, { status: 400 })

  try {
    const { data, error } = await requireSupabase().from('aquecimento_scripts').update(update).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ script: scriptFromRow(data) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { error } = await requireSupabase().from('aquecimento_scripts').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
