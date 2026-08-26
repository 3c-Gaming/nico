import { NextRequest, NextResponse } from 'next/server'
import { requireSupabase, parFromRow } from '@/lib/aquecimento/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  if (body.contactIdA !== undefined) update.contact_id_a = body.contactIdA
  if (body.contactIdB !== undefined) update.contact_id_b = body.contactIdB
  if (body.ativo !== undefined) update.ativo = body.ativo
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'nada pra atualizar' }, { status: 400 })

  try {
    const { data, error } = await requireSupabase().from('aquecimento_pares').update(update).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ par: parFromRow(data) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { error } = await requireSupabase().from('aquecimento_pares').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
