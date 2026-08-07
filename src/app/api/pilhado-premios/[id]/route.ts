import { NextRequest, NextResponse } from 'next/server'
import type { DisparoPilhado } from '@/types'
import { atualizarDisparoPilhado, deletarDisparoPilhado } from '@/lib/db/supabase'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const updates = (await request.json()) as Partial<DisparoPilhado>
  const atualizado = await atualizarDisparoPilhado(id, updates)
  if (!atualizado) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ disparo: atualizado })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = await deletarDisparoPilhado(id)
  return NextResponse.json({ ok })
}
