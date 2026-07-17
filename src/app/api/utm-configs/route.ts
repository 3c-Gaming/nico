import { NextRequest, NextResponse } from 'next/server'
import type { UtmConfig } from '@/types'
import { listarUtmConfigs, criarUtmConfig, deletarUtmConfig, atualizarUtmConfig } from '@/lib/api-store'

export async function GET() {
  const configs = await listarUtmConfigs()
  return NextResponse.json({ configs })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const agora = new Date().toISOString()
  const config: UtmConfig = {
    ...body,
    id: body.id ?? crypto.randomUUID(),
    criadoEm: agora,
  }
  await criarUtmConfig(config)
  return NextResponse.json({ config })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  const result = await atualizarUtmConfig(id, data)
  if (!result) return NextResponse.json({ error: 'config não encontrada' }, { status: 404 })
  return NextResponse.json({ config: result })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  await deletarUtmConfig(id)
  return NextResponse.json({ ok: true })
}
