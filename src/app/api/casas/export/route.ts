import { NextRequest, NextResponse } from 'next/server'

const API_BASE = 'https://3cgg-api-server-production.up.railway.app'
const API_KEY = process.env.EXPORT_API_KEY
const PROJECT = 'pilhado'

interface CasaItem {
  registrations: number
  ftds: number
  cpa: number
  [key: string]: unknown
}

interface CasaExportResponse {
  ok: boolean
  data: CasaItem[]
  count: number
  error?: string
}

async function fetchCasa(casa: 'superbet' | 'mgm', date: string): Promise<CasaExportResponse> {
  if (!API_KEY) {
    return { ok: false, data: [], count: 0, error: 'EXPORT_API_KEY não configurada' }
  }

  const url = `${API_BASE}/export/${casa}?key=${API_KEY}&project=${PROJECT}&date=${date}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { ok: false, data: [], count: 0, error: `HTTP ${res.status}: ${txt}` }
    }
    const json = await res.json()
    return {
      ok: json.ok ?? true,
      data: json.data ?? [],
      count: json.count ?? 0,
    }
  } catch (err) {
    return { ok: false, data: [], count: 0, error: String(err) }
  }
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) {
    return NextResponse.json({ error: 'Param "date" é obrigatório (YYYY-MM-DD)' }, { status: 400 })
  }

  const [superbet, mgm] = await Promise.allSettled([
    fetchCasa('superbet', date),
    fetchCasa('mgm', date),
  ])

  const extract = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === 'fulfilled' ? r.value : fallback

  return NextResponse.json({
    date,
    superbet: extract(superbet, { ok: false, data: [], count: 0, error: 'fetch failed' }),
    mgm: extract(mgm, { ok: false, data: [], count: 0, error: 'fetch failed' }),
  })
}
