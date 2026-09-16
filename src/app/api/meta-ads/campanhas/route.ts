import { NextRequest, NextResponse } from 'next/server'
import { buscarCampanhasMeta } from '@/lib/metaAds'

export type { CampanhaMeta } from '@/lib/metaAds'

// Nome de campanha do Meta não segue um padrão confiável pra achar sozinho qual funil é (ex:
// "F01"/"F01.02" aparece tanto no funil F01.11 quanto num produto completamente diferente) — por
// isso essa rota só busca/normaliza os dados, sem tentar casar com funil nenhum; a atribuição é
// manual, feita no painel de Detalhes (ver FlowTagConfig.campanhasMeta).
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from e to são obrigatórios (YYYY-MM-DD)' }, { status: 400 })

  try {
    const campanhas = await buscarCampanhasMeta(from, to)
    return NextResponse.json({ from, to, campanhas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
