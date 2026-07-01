import { NextRequest, NextResponse } from 'next/server'
import type { Disparo, Esteira } from '@/types'
import { listarDisparos, criarDisparo, criarEsteira } from '@/lib/api-store'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const casa = searchParams.get('casa')
  const tipo = searchParams.get('tipo')
  const status = searchParams.get('status')

  const lista = await listarDisparos({ casa: casa ?? undefined, tipo: tipo ?? undefined, status: status ?? undefined })
  return NextResponse.json({ disparos: lista })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { disparo, criarEsteira: shouldCriarEsteira } = body

  const id = crypto.randomUUID()
  const agora = new Date().toISOString()
  const novo: Disparo = { ...disparo, id, criadoEm: agora, atualizadoEm: agora }

  await criarDisparo(novo)

  let esteira: Esteira | undefined

  if (shouldCriarEsteira && novo.tipo === 'D1') {
    esteira = {
      id: crypto.randomUUID(),
      nome: novo.nomenclatura,
      casasAposta: [...novo.casasAposta],
      disparos: { d1: id },
      criadaEm: agora,
      atualizadoEm: agora,
      ativa: true,
    }
    await criarEsteira(esteira)
  }

  return NextResponse.json({ disparo: novo, esteira })
}
