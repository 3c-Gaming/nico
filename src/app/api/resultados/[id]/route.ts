import { NextResponse } from 'next/server'
import { getResultado, atualizarResultado, deletarResultado } from '@/lib/api-store'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resultado = await getResultado(id)
  if (!resultado) return NextResponse.json({ error: 'Resultado não encontrado' }, { status: 404 })
  return NextResponse.json({ resultado })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const resultado = await atualizarResultado(id, body)
  if (!resultado) return NextResponse.json({ error: 'Resultado não encontrado' }, { status: 404 })

  return NextResponse.json({ resultado })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = await deletarResultado(id)
  if (!ok) return NextResponse.json({ error: 'Resultado não encontrado' }, { status: 404 })

  return NextResponse.json({ deleted: id })
}
