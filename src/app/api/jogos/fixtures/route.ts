import { NextRequest, NextResponse } from 'next/server'
import { buscarJogosPorData } from '@/lib/integrações/footballApi'
import { getOrFetch } from '@/lib/cache'
import { hojeBrasilISO } from '@/lib/datas'

const UM_DIA = 24 * 60 * 60 * 1000

/**
 * TTL por tipo de data — o plano free da API-Football dá só 100 requests/dia, então cachear
 * bem é o que garante que dá pra navegar o calendário sem estourar a cota:
 * - Passado: os jogos já aconteceram, o placar não muda mais — cache mais longo.
 * - Hoje: pode ter jogo ao vivo, mas isso aqui é só consulta (sem placar em tempo real por
 *   enquanto) — um TTL de algumas horas já é suficiente.
 * - Futuro: tabela raramente muda (adiamento é raro) — cache também longo.
 */
function ttlParaData(dataISO: string): number {
  const hoje = hojeBrasilISO()
  if (dataISO < hoje) return 3 * UM_DIA
  if (dataISO === hoje) return 6 * 60 * 60 * 1000
  return UM_DIA
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Parâmetro "date" obrigatório (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const jogos = await getOrFetch('jogos-fixtures', date, ttlParaData(date), () =>
      buscarJogosPorData(date, AbortSignal.timeout(20_000)),
    )
    return NextResponse.json({ jogos })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
