import { NextRequest, NextResponse } from 'next/server'
import { buscarEventosTrackingDoDia, CASAS_TRACKING, type CasaTracking } from '@/lib/tracking'

export async function GET(request: NextRequest) {
  const casa = request.nextUrl.searchParams.get('casa') as CasaTracking | null
  const date = request.nextUrl.searchParams.get('date') ?? ''

  if (casa && !CASAS_TRACKING.includes(casa)) {
    return NextResponse.json({ error: `Casa inválida. Use: ${CASAS_TRACKING.join(', ')}` }, { status: 400 })
  }

  try {
    const casasParaBuscar: CasaTracking[] = casa ? [casa] : [...CASAS_TRACKING]
    const resultados: Record<string, unknown> = {}

    for (const c of casasParaBuscar) {
      try {
        resultados[c] = { data: await buscarEventosTrackingDoDia(c, date) }
      } catch (err) {
        resultados[c] = { error: (err as Error).message }
      }
    }

    if (casa) {
      return NextResponse.json(resultados[casa])
    }
    return NextResponse.json(resultados)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
