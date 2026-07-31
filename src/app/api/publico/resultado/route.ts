import { NextRequest, NextResponse } from 'next/server'

const EXPORT_API_BASE = 'https://3cgg-extraction-system.up.railway.app'
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

async function fetchExportData(casa: 'superbet' | 'mgm', date: string): Promise<ExportItem[]> {
  if (!EXPORT_API_KEY) throw new Error('EXPORT_API_KEY não configurada')
  const apiCasa = casa === 'mgm' ? 'betmgm' : casa
  const url = `${EXPORT_API_BASE}/export/${apiCasa}?key=${EXPORT_API_KEY}&project=${PROJECT}&date=${date}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Export API: ${res.status}`)
  const data = await res.json()
  return (data.data as ExportItem[]) ?? []
}

/**
 * GET /api/publico/resultado?casa=<SuperBet|BetMGM>&utm=<utm ou pid>&date=YYYY-MM-DD
 *
 * Busca registros, ftds e cpa de uma utm/pid específica em uma data, por casa.
 * Superbet casa por substring no acid; BetMGM casa por igualdade exata do pid.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const casaParam = searchParams.get('casa')?.trim()
  const utm = (searchParams.get('utm') ?? searchParams.get('pid'))?.trim()
  const date = searchParams.get('date')?.trim()

  if (!casaParam || !utm || !date) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios: casa, utm (ou pid), date (YYYY-MM-DD)' },
      { status: 400 },
    )
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Parâmetro "date" deve estar no formato YYYY-MM-DD' },
      { status: 400 },
    )
  }

  const casaId = parseCasa(casaParam)
  if (!casaId) {
    return NextResponse.json(
      { error: `Casa "${casaParam}" não reconhecida. Use "SuperBet" ou "BetMGM".` },
      { status: 400 },
    )
  }

  let items: ExportItem[]
  try {
    items = await fetchExportData(casaId, date)
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao consultar dados de resultado: ${(err as Error).message}` },
      { status: 502 },
    )
  }

  let registros = 0
  let ftds = 0
  let cpa = 0

  for (const item of items) {
    if (casaId === 'superbet') {
      const acid = String(item.acid ?? '')
      if (!acid.includes(utm)) continue
    } else {
      if (String(item.marketing_source_id ?? '') !== utm) continue
    }
    registros += item.registrations ?? 0
    ftds += item.ftds ?? 0
    cpa += item.cpa ?? 0
  }

  return NextResponse.json({
    casa: casaId,
    utm,
    date,
    registros,
    ftds,
    cpa,
  })
}
