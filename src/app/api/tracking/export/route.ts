import { NextRequest, NextResponse } from 'next/server'

const TRACKING_BASE = 'https://3cgg-tracking-system.up.railway.app'
const API_KEY = process.env.TRACKING_API_KEY

const CASAS = ['superbet', 'betmgm'] as const
type Casa = (typeof CASAS)[number]

interface TrackingEvent {
  bethouse: string
  event: string
  occurred_at: string
  acid?: string
  pid?: string
  value?: number
  currency?: string
}

interface AggregatedItem {
  [key: string]: unknown
  registrations: number
  ftds: number
}

function aggregateSuperbet(events: TrackingEvent[]): AggregatedItem[] {
  const map = new Map<string, { acid: string; registrations: number; ftds: number }>()
  for (const ev of events) {
    const acid = ev.acid ?? ''
    if (!acid) continue
    if (!map.has(acid)) map.set(acid, { acid, registrations: 0, ftds: 0 })
    const agg = map.get(acid)!
    if (ev.event === 'reg') agg.registrations++
    else if (ev.event === 'ftd') agg.ftds++
  }
  return Array.from(map.values())
}

function aggregateBetmgm(events: TrackingEvent[]): AggregatedItem[] {
  const map = new Map<string, { marketing_source_id: string; registrations: number; ftds: number }>()
  for (const ev of events) {
    const pid = ev.pid ?? ''
    if (!pid) continue
    if (!map.has(pid)) map.set(pid, { marketing_source_id: pid, registrations: 0, ftds: 0 })
    const agg = map.get(pid)!
    if (ev.event === 'registration') agg.registrations++
    else if (ev.event === 'ftd') agg.ftds++
  }
  return Array.from(map.values())
}

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'TRACKING_API_KEY não configurada' }, { status: 500 })
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
      const url = `${TRACKING_BASE}/export/${c}?key=${API_KEY}${date ? `&date=${date}` : ''}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      })

      if (!res.ok) {
        const texto = await res.text().catch(() => '')
        resultados[c] = { error: `HTTP ${res.status}: ${texto}` }
        continue
      }

      const json = await res.json()
      const events = (json.data ?? []) as TrackingEvent[]

      if (c === 'superbet') {
        resultados[c] = { data: aggregateSuperbet(events) }
      } else {
        resultados[c] = { data: aggregateBetmgm(events) }
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
