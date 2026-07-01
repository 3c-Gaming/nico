import { NextRequest, NextResponse } from 'next/server'
import { getDisparo, atualizarDisparo, deletarDisparo } from '@/lib/api-store'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const disparo = await getDisparo(id)
  if (!disparo) return NextResponse.json({ error: 'Disparo não encontrado' }, { status: 404 })
  return NextResponse.json({ disparo })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const atualizado = await atualizarDisparo(id, body)
  if (!atualizado) return NextResponse.json({ error: 'Disparo não encontrado' }, { status: 404 })
  return NextResponse.json({ disparo: atualizado })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ok = await deletarDisparo(id)
  if (!ok) return NextResponse.json({ error: 'Disparo não encontrado' }, { status: 404 })
  return NextResponse.json({ deleted: [id] })
}
