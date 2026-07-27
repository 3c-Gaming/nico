import { NextRequest, NextResponse } from 'next/server'
import type { Disparo, Esteira } from '@/types'
import { listarDisparos, criarDisparo, criarEsteira, getDisparoPorDaxxCampanhaId, upsertEtapaDaxx } from '@/lib/api-store'

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
  const { disparo, esteira, filhos, cicloChave } = body

  const agora = new Date().toISOString()
  const pai: Disparo = { ...disparo, criadoEm: agora, atualizadoEm: agora }

  try {
    await criarDisparo(pai)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('DUPLICATE_DAXX_CAMPANHA')) {
      const existente = pai.daxxCampanhaId ? await getDisparoPorDaxxCampanhaId(pai.daxxCampanhaId) : null
      return NextResponse.json({ error: 'duplicate', disparo: existente }, { status: 409 })
    }
    throw err
  }

  let esteiraPersistida: Esteira | undefined
  const filhosPersistidos: Disparo[] = []

  // Compatibilidade com o fluxo manual (esteira+filhos já montados no cliente)
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

  // Fluxo DAXX: anexa (ou cria) a esteira do ciclo de forma atômica no banco
  if (cicloChave) {
    esteiraPersistida = await upsertEtapaDaxx({
      esteiraId: crypto.randomUUID(),
      chave: cicloChave,
      nome: pai.nomenclatura,
      casas: pai.casasAposta,
      etapa: { tipo: pai.tipo, disparoId: pai.id },
      disparoId: pai.id,
    })
    pai.esteiraPaiId = esteiraPersistida.id
  }

  return NextResponse.json({ disparo: pai, esteira: esteiraPersistida, filhos: filhosPersistidos })
}
