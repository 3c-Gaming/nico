import type { Disparo } from '@/types'

const ACID_REGEX = /^\d{2}-\d{2}-\d{2}-\d{2}-(\w+)-(\w+)-/

export function parseAcid(acid: string): { funil: string; projeto: string } | null {
  const m = acid.match(ACID_REGEX)
  if (!m) return null
  return { funil: m[1], projeto: m[2] }
}

export function getAcidWords(acid: string): string[] {
  const parts = acid.split('-')
  return parts.slice(4, -1)
}

export function matchEventToDisparo(
  evento: { bethouse: string; event: string; acid?: string; pid?: number },
  disparos: Disparo[],
): Disparo | null {
  if (evento.bethouse === 'superbet' && evento.acid) {
    const parsed = parseAcid(evento.acid)
    const match = parsed
      ? disparos.find((d) => d.utm && d.utm === parsed.funil)
      : null
    if (match) return match
    const words = getAcidWords(evento.acid)
    return disparos.find((d) => d.utm && words.some((w) => d.utm!.includes(w))) ?? null
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

    if (ev.event === 'reg') acc[match.id].registros++
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
  const todosEventos: { bethouse: string; event: string; acid?: string; pid?: number }[] = []

  for (const casa of ['superbet', 'betmgm'] as const) {
    const d = data[casa]
    if (d?.data && Array.isArray(d.data)) {
      for (const item of d.data) {
        todosEventos.push({
          bethouse: casa,
          event: item.event,
          acid: item.acid,
          pid: item.pid,
        })
      }
    }
  }

  return agregarPorDisparo(todosEventos, disparos)
}

export async function sincronizarDisparosServer(
  disparos: Disparo[],
  date?: string,
): Promise<Record<string, TrackingResultado>> {
  const TRACKING_BASE = 'https://3cgg-tracking-system-production.up.railway.app'
  const API_KEY = process.env.TRACKING_API_KEY

  if (!API_KEY) {
    throw new Error('TRACKING_API_KEY não configurada')
  }

  const comTracking = disparos.filter((d) => d.utm || d.betmgmPid)
  if (!comTracking.length) return {}

  async function fetchCasa(casa: string) {
    const url = `${TRACKING_BASE}/export/${casa}?key=${API_KEY}${date ? `&date=${date}` : ''}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return []
    const json = await res.json()
    return (json.data ?? []).map((item: Record<string, unknown>) => ({
      bethouse: casa,
      event: item.event,
      acid: item.acid,
      pid: item.pid,
    }))
  }

  const [superbetEvents, betmgmEvents] = await Promise.all([
    fetchCasa('superbet'),
    fetchCasa('betmgm'),
  ])

  return agregarPorDisparo([...superbetEvents, ...betmgmEvents], disparos)
}
