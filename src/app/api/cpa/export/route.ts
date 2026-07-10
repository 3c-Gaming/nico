import { NextRequest, NextResponse } from 'next/server'

const CPA_BASE = 'https://3cgg-tracking-system.up.railway.app'
const API_KEY = process.env.TRACKING_API_KEY

function getOntemSP(): string {
  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  return ontem.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function parseSuperbetAcid(acid: string): string | null {
  if (!acid) return null

  // Novo formato (dashes): DD-MM-HH-MM-<funil>-<projeto>-<uuid>
  const dashParts = acid.split('-')
  if (dashParts.length >= 6) {
    return dashParts[4] || null
  }

  // Fallback formato antigo (underscores): DD_MM_HH_MM_<funil>_<projeto>_...
  const underscoreParts = acid.split('_')
  if (underscoreParts.length >= 6) {
    return underscoreParts[4] || null
  }

  return null
}

interface TrackingEvent {
  event: string
  occurred_at: string
  acid?: string
  pid?: string
  value?: number
  currency?: string
}

interface CpaItem {
  pid: string
  registrations: number
  ftds: number
  cpa: number
}

function aggregateSuperbetCpa(events: TrackingEvent[]): CpaItem[] {
  const map = new Map<string, { pid: string; registrations: number; ftds: number; cpa: number }>()
  for (const ev of events) {
    const acid = ev.acid ?? ''
    if (!acid) continue
    const pid = parseSuperbetAcid(acid) || 'unknown'
    if (!map.has(pid)) map.set(pid, { pid, registrations: 0, ftds: 0, cpa: 0 })
    const agg = map.get(pid)!
    if (ev.event === 'reg') agg.registrations++
    else if (ev.event === 'ftd') {
      agg.ftds++
      agg.cpa += ev.value ?? 0
    }
  }
  return Array.from(map.values())
}

function aggregateBetmgmCpa(events: TrackingEvent[]): CpaItem[] {
  const map = new Map<string, { pid: string; registrations: number; ftds: number; cpa: number }>()
  for (const ev of events) {
    const pid = ev.pid ?? ''
    if (!pid) continue
    if (!map.has(pid)) map.set(pid, { pid, registrations: 0, ftds: 0, cpa: 0 })
    const agg = map.get(pid)!
    if (ev.event === 'registration') agg.registrations++
    else if (ev.event === 'ftd') {
      agg.ftds++
      agg.cpa += ev.value ?? 0
    }
  }
  return Array.from(map.values())
}

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'TRACKING_API_KEY não configurada' }, { status: 500 })
  }

  const date = req.nextUrl.searchParams.get('date') || getOntemSP()

  async function fetchCasa(casa: string) {
    const url = `${CPA_BASE}/export/${casa}?key=${API_KEY}&date=${date}`
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      })
      if (res.status === 404) return { data: [], error: null }
      if (!res.ok) return { data: [], error: `HTTP ${res.status}` }
      const json = await res.json()
      const events = (json.data ?? []) as TrackingEvent[]
      return { data: events, error: null }
    } catch (err) {
      return { data: [], error: String(err) }
    }
  }

  const [superbetRaw, betmgmRaw] = await Promise.allSettled([
    fetchCasa('superbet'),
    fetchCasa('betmgm'),
  ])

  const extract = <T>(r: PromiseSettledResult<T>, fallback: T) =>
    r.status === 'fulfilled' ? r.value : fallback

  const superbetData = extract(superbetRaw, { data: [], error: 'fetch failed' })
  const betmgmData = extract(betmgmRaw, { data: [], error: 'fetch failed' })

  const superbet = {
    data: aggregateSuperbetCpa(superbetData.data),
    error: superbetData.error,
  }

  const betmgm = {
    data: aggregateBetmgmCpa(betmgmData.data),
    error: betmgmData.error,
  }

  return NextResponse.json({ date, superbet, betmgm })
}
