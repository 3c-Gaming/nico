import { NextRequest, NextResponse } from 'next/server'
import type { DisparoPilhado } from '@/types'
import { listarDisparosPilhado, criarDisparoPilhado, getDisparoPilhadoPorDaxxCampanhaId } from '@/lib/db/supabase'

export async function GET() {
  const lista = await listarDisparosPilhado()
  return NextResponse.json({ disparos: lista })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const disparo = body.disparo as DisparoPilhado

  const agora = new Date().toISOString()
  const registro: DisparoPilhado = { ...disparo, criadoEm: agora, atualizadoEm: agora }

  try {
    const criado = await criarDisparoPilhado(registro)
    return NextResponse.json({ disparo: criado })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('DUPLICATE_DAXX_CAMPANHA')) {
      const existente = registro.daxxCampanhaId ? await getDisparoPilhadoPorDaxxCampanhaId(registro.daxxCampanhaId) : null
      return NextResponse.json({ error: 'duplicate', disparo: existente }, { status: 409 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
