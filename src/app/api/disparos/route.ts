import { NextRequest, NextResponse } from 'next/server'
import type { Disparo, Esteira } from '@/types'
import { getApiStore } from '@/lib/api-store'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const casa = searchParams.get('casa')
  const tipo = searchParams.get('tipo')
  const status = searchParams.get('status')

  const store = getApiStore()
  let lista = Object.values(store.disparos)

  if (casa) lista = lista.filter((d) => d.casasAposta.includes(casa))
  if (tipo) lista = lista.filter((d) => d.tipo === tipo)
  if (status) lista = lista.filter((d) => d.status === status)

  return NextResponse.json({ disparos: lista })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { disparo, criarEsteira } = body

  const id = crypto.randomUUID()
  const agora = new Date().toISOString()
  const novo: Disparo = { ...disparo, id, criadoEm: agora, atualizadoEm: agora }

  const store = getApiStore()
  store.disparos[id] = novo

  let esteira: Esteira | undefined

  if (criarEsteira && novo.tipo === 'D1') {
    esteira = {
      id: crypto.randomUUID(),
      nome: novo.nomenclatura,
      casasAposta: [...novo.casasAposta],
      disparos: { d1: id },
      criadaEm: agora,
      atualizadoEm: agora,
      ativa: true,
    }
    store.esteiras[esteira.id] = esteira
  }

  return NextResponse.json({ disparo: novo, esteira })
}
