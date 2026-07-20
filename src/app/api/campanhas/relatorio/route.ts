import { NextRequest, NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'
const EXPORT_API_BASE = 'https://3cgg-api-server-production.up.railway.app'
const EXPORT_API_KEY = process.env.EXPORT_API_KEY
const PROJECT = 'pilhado'

interface DaxxCampaign {
  id: string
  nome: string
  entregues: number
  dataCriacao: string
}

interface ExportItem {
  acid?: string
  marketing_source_id?: string
  registrations?: number
  ftds?: number
  cpa?: number
}

function daxxDateToISO(str: string): string | null {
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

function parseCasa(casa: string): 'superbet' | 'mgm' | null {
  const lower = casa.toLowerCase()
  if (lower.includes('super')) return 'superbet'
  if (lower.includes('mgm') || lower.includes('bet')) return 'mgm'
  return null
}

async function fetchDaxxCampanhas(): Promise<DaxxCampaign[]> {
  const res = await fetch(`${BRIDGE_URL}/campanhas`, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Bridge DAXX: ${res.status}`)
  const data = await res.json()
  return data.campanhas ?? []
}

async function fetchExportData(
  casa: 'superbet' | 'mgm',
  date: string,
): Promise<ExportItem[]> {
  if (!EXPORT_API_KEY) return []
  const apiCasa = casa === 'mgm' ? 'betmgm' : casa
  const url = `${EXPORT_API_BASE}/export/${apiCasa}?key=${EXPORT_API_KEY}&project=${PROJECT}&date=${date}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data as ExportItem[]) ?? []
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const utm = searchParams.get('utm')
  const casaParam = searchParams.get('casa')
  const nome = searchParams.get('nome')

  if (!date || !utm || !casaParam) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios: date, utm, casa' },
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

  let entregues = 0

  // 1) Buscar campanhas DAXX (bridge com cache de 5min)
  try {
    const campanhas = await fetchDaxxCampanhas()

    const matched = campanhas.filter((c) => {
      const iso = daxxDateToISO(c.dataCriacao)
      if (iso !== date) return false
      if (nome && !c.nome.toLowerCase().includes(nome.toLowerCase())) return false
      return true
    })

    entregues = matched.reduce((sum, c) => sum + c.entregues, 0)
  } catch {
    // bridge indisponível — segue sem entregues
  }

  // 2) Buscar dados de export da Railway
  let registros = 0
  let ftds = 0
  let cpas = 0

  try {
    const items = await fetchExportData(casaId, date)

    for (const item of items) {
      if (casaId === 'superbet') {
        const acid = String(item.acid ?? '')
        if (acid.includes(utm)) {
          registros += item.registrations ?? 0
          ftds += item.ftds ?? 0
          cpas += item.cpa ?? 0
        }
      } else {
        // mgm — match exato
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
    entregues,
    registros,
    ftds,
    cpas,
  })
}
