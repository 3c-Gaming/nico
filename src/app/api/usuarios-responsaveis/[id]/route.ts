import { NextResponse } from 'next/server'
import { deletarUsuarioResponsavel } from '@/lib/api-store'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = await deletarUsuarioResponsavel(id)
  if (!ok) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json({ deleted: id })
}
