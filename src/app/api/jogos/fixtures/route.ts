import { NextRequest, NextResponse } from 'next/server'
import { buscarJogosPorData } from '@/lib/integrações/sofascoreBridge'
import { getOrFetch } from '@/lib/cache'
import { hojeBrasilISO } from '@/lib/datas'

const UM_DIA = 24 * 60 * 60 * 1000

/**
 * TTL por tipo de data — cachear bem evita reabrir sessão/refazer os 7 fetches (um por liga) no
 * scraper a cada navegação no calendário:
 * - Passado: os jogos já aconteceram, o placar não muda mais — cache mais longo.
 * - Hoje: pode ter jogo ao vivo — TTL de algumas horas.
 * - Futuro: tabela raramente muda (adiamento é raro) — cache também longo. O SofaScore não tem a
 *   restrição de janela de dias que a API-Football tinha no plano free, então isso vale pra
 *   qualquer data futura, não só amanhã.
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
    const jogos = await getOrFetch('jogos-fixtures-sofascore', date, ttlParaData(date), () =>
      buscarJogosPorData(date, AbortSignal.timeout(30_000)),
    )
    return NextResponse.json({ jogos })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
