import { NextRequest, NextResponse } from 'next/server'

const EXPORT_API_BASE = 'https://3cgg-api-server-production.up.railway.app'
const EXPORT_API_KEY = process.env.EXPORT_API_KEY
const PROJECT = 'pilhado'

interface ExportItem {
  acid?: string
  marketing_source_id?: string
  registrations?: number
  ftds?: number
  cpa?: number
}

function parseCasa(casa: string): 'superbet' | 'mgm' | null {
  const lower = casa.toLowerCase()
  if (lower.includes('super')) return 'superbet'
  if (lower.includes('mgm') || lower.includes('bet')) return 'mgm'
  return null
}

async function fetchExportData(
  casa: 'superbet' | 'mgm',
  date: string,
): Promise<ExportItem[]> {
  if (!EXPORT_API_KEY) return []
  const url = `${EXPORT_API_BASE}/export/${casa}?key=${EXPORT_API_KEY}&project=${PROJECT}&date=${date}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data as ExportItem[]) ?? []
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
      { error: `Casa "${casaParam}" não reconhecida. Use "superbet" ou "mgm".` },
      { status: 400 },
    )
  }

  let registros = 0
  let ftds = 0
  let cpas = 0

  try {
    const items = await fetchExportData(casaId, date)
    const normalizedUtm = utm.replace(/-/g, '_').toLowerCase()

    for (const item of items) {
      if (casaId === 'superbet') {
        const acid = String(item.acid ?? '').replace(/-/g, '_').toLowerCase()
        if (acid.includes(normalizedUtm)) {
          registros += item.registrations ?? 0
          ftds += item.ftds ?? 0
          cpas += item.cpa ?? 0
        }
      } else {
        if (String(item.marketing_source_id ?? '') === utm) {
          registros += item.registrations ?? 0
          ftds += item.ftds ?? 0
          cpas += item.cpa ?? 0
        }
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
    cpas,
  })
}
