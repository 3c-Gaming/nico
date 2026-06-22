import { NextRequest, NextResponse } from 'next/server'
import type { Esteira } from '@/types'
import { getApiStore } from '@/lib/api-store'

export async function GET() {
  const store = getApiStore()
  return NextResponse.json({ esteiras: Object.values(store.esteiras).filter((e: Esteira) => e.ativa) })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const id = crypto.randomUUID()
  const agora = new Date().toISOString()

  const esteira: Esteira = {
    ...body,
    id,
    criadaEm: agora,
    atualizadoEm: agora,
    ativa: true,
  }

  const store = getApiStore()
  store.esteiras[id] = esteira
  return NextResponse.json({ esteira })
}
