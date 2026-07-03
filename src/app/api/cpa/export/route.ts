import { NextRequest, NextResponse } from 'next/server'

const CPA_BASE = 'https://3cgg-api-server-production.up.railway.app'
const PROJECT = 'pilhado'

function getOntemSP(): string {
  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  return ontem.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function parseSuperbetAcid(acid: string): string | null {
  const parts = acid.split('_')
  if (parts.length < 6) return null
  const relevant = parts.slice(4)
  const projectIdx = relevant.indexOf(PROJECT)
  if (projectIdx === -1) return null
  const pid = relevant.slice(0, projectIdx).join('_')
  return pid || null
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.EXPORT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'EXPORT_API_KEY não configurada' }, { status: 500 })
  }

  const date = req.nextUrl.searchParams.get('date') || getOntemSP()
  const project = req.nextUrl.searchParams.get('project') || PROJECT

  async function fetchCasa(casa: string) {
    const url = `${CPA_BASE}/export/${casa}?project=${project}&date=${date}`
    try {
      const res = await fetch(url, {
        headers: { 'x-export-key': apiKey! },
        signal: AbortSignal.timeout(15_000),
      })
      if (res.status === 404) return { data: [], error: null }
      if (!res.ok) return { data: [], error: `HTTP ${res.status}` }
      const json = await res.json()
      const items = (json.data ?? []) as Record<string, unknown>[]
      return { data: items, error: null }
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
    data: superbetData.data.map((item: Record<string, unknown>) => {
      const acid = String(item.acid ?? '')
      return {
        pid: parseSuperbetAcid(acid) || 'unknown',
        registrations: Number(item.registrations ?? 0),
        ftds: Number(item.ftds ?? 0),
        cpa: Number(item.cpa ?? 0),
      }
    }),
    error: superbetData.error,
  }

  const betmgm = {
    data: betmgmData.data.map((item: Record<string, unknown>) => ({
      pid: String(item.marketing_source_name ?? item.marketing_source_id ?? 'unknown'),
      registrations: Number(item.registrations ?? 0),
      ftds: Number(item.ftds ?? 0),
      cpa: Number(item.cpa ?? 0),
    })),
    error: betmgmData.error,
  }

  return NextResponse.json({ date, project, superbet, betmgm })
}
