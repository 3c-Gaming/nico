import { NextRequest, NextResponse } from 'next/server'
import type { Esteira } from '@/types'
import { listarEsteiras, criarEsteira } from '@/lib/api-store'

export async function GET() {
  const esteiras = await listarEsteiras()
  return NextResponse.json({ esteiras })
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

  await criarEsteira(esteira)
  return NextResponse.json({ esteira })
}
