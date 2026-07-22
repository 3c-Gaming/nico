import { NextRequest, NextResponse } from 'next/server'

const TRACKING_BASE = 'https://3cgg-tracking-system.up.railway.app'
const API_KEY = process.env.TRACKING_API_KEY

interface TrackingEvent {
  bethouse: string
  event: string
  occurred_at: string
  acid?: string
  pid?: string
}

function parseCasa(casa: string): 'superbet' | 'betmgm' | null {
  const lower = casa.toLowerCase()
  if (lower.includes('super')) return 'superbet'
  if (lower.includes('mgm') || lower.includes('bet')) return 'betmgm'
  return null
}

async function fetchEvents(casa: 'superbet' | 'betmgm', date: string): Promise<TrackingEvent[]> {
  if (!API_KEY) return []
  const url = `${TRACKING_BASE}/export/${casa}?key=${API_KEY}&date=${date}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data as TrackingEvent[]) ?? []
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const utm = searchParams.get('utm')
  const casaParam = searchParams.get('casa')
  const date = searchParams.get('date')

  if (!utm || !casaParam || !date) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios: utm, casa, date' },
      { status: 400 },
    )
  }

  const casaId = parseCasa(casaParam)
  if (!casaId) {
    return NextResponse.json(
      { error: `Casa "${casaParam}" não reconhecida. Use "superbet" ou "betmgm".` },
      { status: 400 },
    )
  }

  let registros = 0
  let ftds = 0

  try {
    const events = await fetchEvents(casaId, date)
    const normalizedUtm = utm.replace(/-/g, '_').toLowerCase()

    if (casaId === 'superbet') {
      for (const ev of events) {
        const acid = String(ev.acid ?? '').replace(/-/g, '_').toLowerCase()
        if (!acid.includes(normalizedUtm)) continue
        if (ev.event === 'reg') registros++
        else if (ev.event === 'ftd') ftds++
      }
    } else {
      for (const ev of events) {
        if (String(ev.pid ?? '') !== utm) continue
        if (ev.event === 'registration') registros++
        else if (ev.event === 'ftd') ftds++
      }
    }
  } catch {
    // API indisponível — segue com zeros
  }

  return NextResponse.json({
    date,
    utm,
    casa: casaId,
    registros,
    ftds,
  })
}
