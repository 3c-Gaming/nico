import { NextResponse } from 'next/server'
import { getDemanda, atualizarDemanda, deletarDemanda } from '@/lib/api-store'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const demanda = await getDemanda(id)
  if (!demanda) return NextResponse.json({ error: 'Demanda não encontrada' }, { status: 404 })
  return NextResponse.json({ demanda })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const demanda = await atualizarDemanda(id, body)
  if (!demanda) return NextResponse.json({ error: 'Demanda não encontrada' }, { status: 404 })

  return NextResponse.json({ demanda })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = await deletarDemanda(id)
  if (!ok) return NextResponse.json({ error: 'Demanda não encontrada' }, { status: 404 })

  return NextResponse.json({ deleted: id })
}
