import type { Disparo } from '@/types'

const ACID_REGEX = /^\d{2}[-_]\d{2}[-_]\d{2}[-_]\d{2}[-_](\w+)[-_](\w+)/

export function parseAcid(acid: string): { funil: string; projeto: string } | null {
  const m = acid.match(ACID_REGEX)
  if (!m) return null
  return { funil: m[1], projeto: m[2] }
}

export function matchEventToDisparo(
  evento: { bethouse: string; event: string; acid?: string; pid?: string },
  disparos: Disparo[],
): Disparo | null {
  if (evento.bethouse === 'superbet' && evento.acid) {
    const parsed = parseAcid(evento.acid)
    if (!parsed) return null
    return disparos.find((d) => d.utm && d.utm === parsed.funil) ?? null
  }

  if (evento.bethouse === 'betmgm' && evento.pid) {
    return disparos.find(
      (d) => d.betmgmPid && d.betmgmPid === evento.pid,
    ) ?? null
  }

  return null
}

export interface TrackingResultado {
  registros: number
  ftds: number
}

export function agregarPorDisparo(
  eventos: { bethouse: string; event: string; acid?: string; pid?: string }[],
  disparos: Disparo[],
): Record<string, TrackingResultado> {
  const acc: Record<string, TrackingResultado> = {}

  for (const ev of eventos) {
    const match = matchEventToDisparo(ev, disparos)
    if (!match) continue

    if (!acc[match.id]) {
      acc[match.id] = { registros: 0, ftds: 0 }
    }

    if (ev.event === 'reg' || ev.event === 'registration') acc[match.id].registros++
    else if (ev.event === 'ftd') acc[match.id].ftds++
  }

  return acc
}

interface TrackingEvent {
  event: string
  occurred_at: string
  acid?: string
  pid?: string
}

function aggregateEvents(events: TrackingEvent[]): {
  superbet: { acid: string; registrations: number; ftds: number }[]
  betmgm: { marketing_source_id: string; registrations: number; ftds: number }[]
} {
  const sbMap = new Map<string, { acid: string; registrations: number; ftds: number }>()
  const mgmMap = new Map<string, { marketing_source_id: string; registrations: number; ftds: number }>()

  for (const ev of events) {
    if (ev.acid) {
      const acid = ev.acid
      if (!sbMap.has(acid)) sbMap.set(acid, { acid, registrations: 0, ftds: 0 })
      const agg = sbMap.get(acid)!
      if (ev.event === 'reg') agg.registrations++
      else if (ev.event === 'ftd') agg.ftds++
    }
    if (ev.pid) {
      const pid = ev.pid
      if (!mgmMap.has(pid)) mgmMap.set(pid, { marketing_source_id: pid, registrations: 0, ftds: 0 })
      const agg = mgmMap.get(pid)!
      if (ev.event === 'registration') agg.registrations++
      else if (ev.event === 'ftd') agg.ftds++
    }
  }

  return {
    superbet: Array.from(sbMap.values()),
    betmgm: Array.from(mgmMap.values()),
  }
}

export async function sincronizarDisparos(
  disparos: Disparo[],
  date?: string,
): Promise<Record<string, TrackingResultado>> {
  const comTracking = disparos.filter((d) => d.utm || d.betmgmPid)
  if (!comTracking.length) return {}

  const params = new URLSearchParams()
  if (date) params.set('date', date)

  const res = await fetch(
    `/api/tracking/export${params.toString() ? `?${params.toString()}` : ''}`,
    { signal: AbortSignal.timeout(30_000) },
  )

  if (!res.ok) {
    throw new Error(`Erro ao buscar tracking: ${res.status}`)
  }

  const data = await res.json()
  const result: Record<string, TrackingResultado> = {}

  for (const casa of ['superbet', 'betmgm'] as const) {
    const d = data[casa]
    if (!d?.data || !Array.isArray(d.data)) continue
    for (const item of d.data) {
      if (casa === 'betmgm') {
        const pid = String(item.marketing_source_id ?? '')
        if (!pid) continue
        const match = comTracking.find((disparo) => disparo.betmgmPid === pid)
        if (!match) continue
        if (!result[match.id]) result[match.id] = { registros: 0, ftds: 0 }
        result[match.id].registros += item.registrations ?? 0
        result[match.id].ftds += item.ftds ?? 0
      } else {
        const acid = String(item.acid ?? '')
        if (!acid) continue
        const match = comTracking.find((disparo) =>
          disparo.utm && acid.includes(disparo.utm),
        )
        if (!match) continue
        if (!result[match.id]) result[match.id] = { registros: 0, ftds: 0 }
        result[match.id].registros += item.registrations ?? 0
        result[match.id].ftds += item.ftds ?? 0
      }
    }
  }

  return result
}

export async function sincronizarDisparosServer(
  disparos: Disparo[],
  date?: string,
): Promise<Record<string, TrackingResultado>> {
  const TRACKING_BASE = 'https://3cgg-tracking-system.up.railway.app'
  const API_KEY = process.env.TRACKING_API_KEY

  if (!API_KEY) {
    throw new Error('TRACKING_API_KEY não configurada')
  }

  const comTracking = disparos.filter((d) => d.utm || d.betmgmPid)
  if (!comTracking.length) return {}

  async function fetchCasa(casa: string): Promise<TrackingEvent[]> {
    const url = `${TRACKING_BASE}/export/${casa}?key=${API_KEY}${date ? `&date=${date}` : ''}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return []
    const json = await res.json()
    return json.data ?? []
  }

  const [superbetEvents, betmgmEvents] = await Promise.all([
    fetchCasa('superbet'),
    fetchCasa('betmgm'),
  ])

  const { superbet: superbetAgg, betmgm: betmgmAgg } = aggregateEvents([
    ...superbetEvents.map((e) => ({ ...e, bethouse: 'superbet' as const })),
    ...betmgmEvents.map((e) => ({ ...e, bethouse: 'betmgm' as const })),
  ])

  const result: Record<string, TrackingResultado> = {}

  for (const item of superbetAgg) {
    const acid = item.acid
    if (!acid) continue
    const match = comTracking.find((d) =>
      d.utm && acid.includes(d.utm),
    )
    if (!match) continue
    if (!result[match.id]) result[match.id] = { registros: 0, ftds: 0 }
    result[match.id].registros += item.registrations
    result[match.id].ftds += item.ftds
  }

  for (const item of betmgmAgg) {
    const pid = item.marketing_source_id
    if (!pid) continue
    const match = comTracking.find((d) => d.betmgmPid === pid)
    if (!match) continue
    if (!result[match.id]) result[match.id] = { registros: 0, ftds: 0 }
    result[match.id].registros += item.registrations
    result[match.id].ftds += item.ftds
  }

  return result
}
