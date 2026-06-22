import { NextRequest, NextResponse } from 'next/server'
import { getApiStore } from '@/lib/api-store'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const store = getApiStore()
  const disparo = store.disparos[id]
  if (!disparo) return NextResponse.json({ error: 'Disparo não encontrado' }, { status: 404 })
  return NextResponse.json({ disparo })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const store = getApiStore()
  if (!store.disparos[id]) return NextResponse.json({ error: 'Disparo não encontrado' }, { status: 404 })

  const body = await request.json()
  store.disparos[id] = { ...store.disparos[id], ...body, atualizadoEm: new Date().toISOString() }

  return NextResponse.json({ disparo: store.disparos[id] })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const store = getApiStore()
  if (!store.disparos[id]) return NextResponse.json({ error: 'Disparo não encontrado' }, { status: 404 })

  const deleted = [id]

  for (const esteiraId of Object.keys(store.esteiras)) {
    const e = store.esteiras[esteiraId]
    if (e.disparos.d1 === id || e.disparos.d3 === id || e.disparos.d5 === id || e.disparos.d7 === id) {
      delete store.esteiras[esteiraId]
      deleted.push(esteiraId)
    }
  }

  delete store.disparos[id]
  return NextResponse.json({ deleted })
}
