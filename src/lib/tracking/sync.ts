import type { Disparo } from '@/types'

const ACID_REGEX = /^\d{2}_\d{2}_\d{2}_\d{2}_(\w+)_(\w+)_/

export function parseAcid(acid: string): { funil: string; projeto: string } | null {
  const m = acid.match(ACID_REGEX)
  if (!m) return null
  return { funil: m[1], projeto: m[2] }
}

export function matchEventToDisparo(
  evento: { bethouse: string; event: string; acid?: string; pid?: number },
  disparos: Disparo[],
): Disparo | null {
  if (evento.bethouse === 'superbet' && evento.acid) {
    const parsed = parseAcid(evento.acid)
    if (!parsed) return null
    return disparos.find((d) => d.utm && d.utm === parsed.funil) ?? null
  }

  if (evento.bethouse === 'betmgm' && evento.pid != null) {
    return disparos.find(
      (d) => d.betmgmPid && d.betmgmPid === String(evento.pid),
    ) ?? null
  }

  return null
}

export interface TrackingResultado {
  registros: number
  ftds: number
}

export function agregarPorDisparo(
  eventos: { bethouse: string; event: string; acid?: string; pid?: number }[],
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
          disparo.utm && acid.includes(disparo.utm.replace(/-/g, '_'))
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
  const TRACKING_BASE = 'https://3cgg-api-server-production.up.railway.app'
  const API_KEY = process.env.EXPORT_API_KEY
  const PROJECT = 'pilhado'

  if (!API_KEY) {
    throw new Error('EXPORT_API_KEY não configurada')
  }

  const comTracking = disparos.filter((d) => d.utm || d.betmgmPid)
  if (!comTracking.length) return {}

  async function fetchCasa(casa: string) {
    const url = `${TRACKING_BASE}/export/${casa}?key=${API_KEY}&project=${PROJECT}${date ? `&date=${date}` : ''}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return []
    const json = await res.json()
    return json.data ?? []
  }

  const [superbetData, betmgmData] = await Promise.all([
    fetchCasa('superbet'),
    fetchCasa('betmgm'),
  ])

  const result: Record<string, TrackingResultado> = {}

  for (const item of superbetData) {
    const acid = String(item.acid ?? '')
    if (!acid) continue
    const match = comTracking.find((d) =>
      d.utm && acid.includes(d.utm.replace(/-/g, '_'))
    )
    if (!match) continue
    if (!result[match.id]) result[match.id] = { registros: 0, ftds: 0 }
    result[match.id].registros += item.registrations ?? 0
    result[match.id].ftds += item.ftds ?? 0
  }

  for (const item of betmgmData) {
    const pid = String(item.marketing_source_id ?? '')
    if (!pid) continue
    const match = comTracking.find((d) => d.betmgmPid === pid)
    if (!match) continue
    if (!result[match.id]) result[match.id] = { registros: 0, ftds: 0 }
    result[match.id].registros += item.registrations ?? 0
    result[match.id].ftds += item.ftds ?? 0
  }

  return result
}
