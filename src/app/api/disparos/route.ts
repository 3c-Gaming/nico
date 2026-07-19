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
  const { disparo, esteira, filhos } = body

  const agora = new Date().toISOString()
  const pai: Disparo = { ...disparo, criadoEm: agora, atualizadoEm: agora }
  await criarDisparo(pai)

  let esteiraPersistida: Esteira | undefined
  const filhosPersistidos: Disparo[] = []

  if (filhos?.length) {
    for (const f of filhos) {
      const child: Disparo = { ...f, criadoEm: agora, atualizadoEm: agora }
      await criarDisparo(child)
      filhosPersistidos.push(child)
    }
  }

  if (esteira) {
    esteiraPersistida = { ...esteira, criadoEm: agora, atualizadoEm: agora }
    await criarEsteira(esteiraPersistida!)
  }

  return NextResponse.json({ disparo: pai, esteira: esteiraPersistida, filhos: filhosPersistidos })
}
