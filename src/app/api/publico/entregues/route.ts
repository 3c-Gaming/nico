import { NextRequest, NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

interface DaxxCampaign {
  id: string
  nome: string
  entregues: number
  lidas: number
  dataCriacao: string
}

// A planilha às vezes erra a data entre colchetes (referência de quando foi criado o disparo,
// digitada à mão) — mas a data de entrega que vem logo depois de "DISP"/"DISP TOTAL" é
// confiável. Buscamos a partir dali pra não depender do colchete estar certo.
function comecarNaDataDeEntrega(nome: string): string {
  const semColchete = nome.replace(/^\[\d{2}\/\d{2}\]\s*DISP\s*(?:TOTAL\s*)?/i, '').trim()
  return semColchete || nome
}

// A DAXX abrevia o nome de algumas casas nas campanhas (ex: "NOVI" em vez de "NOVIBET"), mas a
// planilha usa o nome completo — geramos variações com as abreviações conhecidas pra não perder
// o match só por causa disso.
const ABREVIACOES_CASA: [string, string][] = [
  ['NOVIBET', 'NOVI'],
  ['BETESPORTE', 'BETE'],
]

// Algumas campanhas na DAXX não repetem a palavra "BASE" que a planilha usa (ex: real é
// "12/07 VAIDEBET D3", planilha escreve "12/07 BASE VAIDEBET D3") — tentamos também sem ela.
function variacoesBusca(nome: string): string[] {
  const variacoes = new Set([nome])
  for (const [completo, abreviado] of ABREVIACOES_CASA) {
    if (nome.toUpperCase().includes(completo)) {
      variacoes.add(nome.replace(new RegExp(completo, 'gi'), abreviado))
    }
  }
  for (const v of [...variacoes]) {
    const semBase = v.replace(/\bBASE\s+/i, '').trim()
    if (semBase && semBase !== v) variacoes.add(semBase)
  }
  return [...variacoes]
}

// A DAXX às vezes tem espaçamento inconsistente entre palavras (ex: "BETE  D3" com espaço
// duplo) — colapsa espaços repetidos antes de comparar pra não perder o match por isso.
function normalizarEspacos(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
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
  const nome = searchParams.get('nome')?.trim()
  const date = searchParams.get('date')?.trim()

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

  const nomeBusca = comecarNaDataDeEntrega(nome)
  const candidatos = variacoesBusca(nomeBusca).map((c) => normalizarEspacos(c).toLowerCase())
  const matched = campanhas.filter((c) => {
    const iso = daxxDateToISO(c.dataCriacao)
    if (iso !== date) return false
    const nomeLower = normalizarEspacos(c.nome).toLowerCase()
    return candidatos.some((cand) => nomeLower.includes(cand))
  })

  const entregues = matched.reduce((sum, c) => sum + c.entregues, 0)
  const lidas = matched.reduce((sum, c) => sum + c.lidas, 0)

  return NextResponse.json({
    nome,
    date,
    entregues,
    lidas,
    campanhas: matched.map((c) => ({
      id: c.id,
      nome: c.nome,
      entregues: c.entregues,
      lidas: c.lidas,
      dataCriacao: c.dataCriacao,
    })),
  })
}
