import { NextRequest, NextResponse } from 'next/server'

const TRACKING_BASE = 'https://3cgg-extraction-system.up.railway.app'
const API_KEY = process.env.EXPORT_API_KEY
const PROJECT = 'pilhado'

const CASAS = ['superbet', 'betmgm'] as const
type Casa = (typeof CASAS)[number]

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'EXPORT_API_KEY não configurada' }, { status: 500 })
  }

  const casa = request.nextUrl.searchParams.get('casa') as Casa | null
  const date = request.nextUrl.searchParams.get('date') ?? ''

  if (casa && !CASAS.includes(casa)) {
    return NextResponse.json({ error: `Casa inválida. Use: ${CASAS.join(', ')}` }, { status: 400 })
  }

  try {
    const casasParaBuscar: Casa[] = casa ? [casa] : [...CASAS]
    const resultados: Record<string, unknown> = {}

    for (const c of casasParaBuscar) {
      const url = `${TRACKING_BASE}/export/${c}?key=${API_KEY}&project=${PROJECT}${date ? `&date=${date}` : ''}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      })

      if (!res.ok) {
        const texto = await res.text().catch(() => '')
        resultados[c] = { error: `HTTP ${res.status}: ${texto}` }
        continue
      }

      const json = await res.json()
      resultados[c] = json
    }

    if (casa) {
      return NextResponse.json(resultados[casa])
    }
    return NextResponse.json(resultados)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
