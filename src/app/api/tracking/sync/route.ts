import { NextRequest, NextResponse } from 'next/server'
import { sincronizarDisparosServer } from '@/lib/tracking/sync'

export async function POST(request: NextRequest) {
  try {
    const { disparos } = await request.json()
    if (!Array.isArray(disparos) || disparos.length === 0) {
      return NextResponse.json({ error: 'Array de disparos é obrigatório' }, { status: 400 })
    }

    const date = request.nextUrl.searchParams.get('date') ?? undefined
    const resultados = await sincronizarDisparosServer(disparos, date)

    return NextResponse.json({ resultados })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
