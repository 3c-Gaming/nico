import { NextResponse } from 'next/server'
import { getResultado, atualizarResultado } from '@/lib/api-store'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const existente = await getResultado(id)
  if (!existente) return NextResponse.json({ error: 'Resultado não encontrado' }, { status: 404 })

  const publicToken = existente.publicToken ?? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const resultado = await atualizarResultado(id, { publicToken })
  if (!resultado) return NextResponse.json({ error: 'Resultado não encontrado' }, { status: 404 })

  return NextResponse.json({ resultado })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resultado = await atualizarResultado(id, { publicToken: null })
  if (!resultado) return NextResponse.json({ error: 'Resultado não encontrado' }, { status: 404 })

  return NextResponse.json({ resultado })
}
