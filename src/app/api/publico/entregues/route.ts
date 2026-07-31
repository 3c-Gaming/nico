import { NextRequest, NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

interface DaxxCampaign {
  id: string
  nome: string
  entregues: number
  dataCriacao: string
}

function daxxDateToISO(str: string): string | null {
  // DAXX retorna "DD/MM/YY, HH:mm" (ano com 2 dígitos) ou, ocasionalmente, "DD/MM/YYYY"
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (!match) return null
  const ano = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${ano}-${match[2]}-${match[1]}`
}

async function fetchDaxxCampanhas(date: string): Promise<DaxxCampaign[]> {
  const url = `${BRIDGE_URL}/campanhas?startDate=${date}&endDate=${date}`
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Bridge DAXX: ${res.status}`)
  const data = await res.json()
  return data.campanhas ?? []
}

/**
 * GET /api/publico/entregues?nome=<campanha>&date=YYYY-MM-DD
 *
 * Busca no DAXX (via scraping) o total de mensagens entregues das campanhas
 * cujo nome contém `nome` (case-insensitive) e cuja data de criação seja `date`.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const nome = searchParams.get('nome')
  const date = searchParams.get('date')

  if (!nome || !date) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios: nome, date (YYYY-MM-DD)' },
      { status: 400 },
    )
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Parâmetro "date" deve estar no formato YYYY-MM-DD' },
      { status: 400 },
    )
  }

  let campanhas: DaxxCampaign[]
  try {
    campanhas = await fetchDaxxCampanhas(date)
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao consultar DAXX: ${(err as Error).message}` },
      { status: 502 },
    )
  }

  const matched = campanhas.filter((c) => {
    const iso = daxxDateToISO(c.dataCriacao)
    if (iso !== date) return false
    return c.nome.toLowerCase().includes(nome.toLowerCase())
  })

  const entregues = matched.reduce((sum, c) => sum + c.entregues, 0)

  return NextResponse.json({
    nome,
    date,
    entregues,
    campanhas: matched.map((c) => ({
      id: c.id,
      nome: c.nome,
      entregues: c.entregues,
      dataCriacao: c.dataCriacao,
    })),
  })
}
