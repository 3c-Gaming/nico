// Cliente do tracking 3CGG (Superbet/BetMGM) — extraído de src/app/api/tracking/export/route.ts
// pra poder ser chamado direto de código server-side que não pode usar fetch relativo (crons,
// rotas que rodam o snapshot diário de funil) além da própria rota, que continua existindo pro uso
// client-side (useEffect da tela de Funis).

const TRACKING_BASE = 'https://3cgg-tracking-system.up.railway.app'
const API_KEY = process.env.TRACKING_API_KEY

export const CASAS_TRACKING = ['superbet', 'betmgm'] as const
export type CasaTracking = (typeof CASAS_TRACKING)[number]

interface TrackingEvent {
  bethouse: string
  event: string
  occurred_at: string
  acid?: string
  pid?: string
  value?: number
  currency?: string
}

export interface AggregatedItem {
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

/** Eventos agregados (registros/FTDs por acid/pid) de uma casa num dia — lança se a API externa ou
 * a key não estiverem disponíveis; quem chama decide se isola o erro (ver rota /api/tracking/export,
 * que devolve `{error}` por casa em vez de derrubar a resposta inteira). */
export async function buscarEventosTrackingDoDia(casa: CasaTracking, date?: string): Promise<AggregatedItem[]> {
  if (!API_KEY) throw new Error('TRACKING_API_KEY não configurada')
  const url = `${TRACKING_BASE}/export/${casa}?key=${API_KEY}${date ? `&date=${date}` : ''}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  const json = await res.json()
  const events = (json.data ?? []) as TrackingEvent[]
  return casa === 'superbet' ? aggregateSuperbet(events) : aggregateBetmgm(events)
}
