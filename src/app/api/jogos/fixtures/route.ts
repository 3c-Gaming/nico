import { NextRequest, NextResponse } from 'next/server'
import { buscarJogosPorIntervalo } from '@/lib/integrações/footballData'
import { getOrFetch } from '@/lib/cache'

const TTL_JOGOS = 3 * 60 * 60 * 1000 // 3h — o intervalo visível sempre inclui hoje (pode ter jogo ao vivo)

export const maxDuration = 30

/** Um único request pro football-data.org cobre o intervalo (dateFrom/dateTo) inteiro pedido
 * pelo calendário da tela de Jogos — ver buscarJogosPorIntervalo sobre por que não é um request
 * por dia. */
export async function GET(request: NextRequest) {
  const dateFrom = request.nextUrl.searchParams.get('dateFrom')
  const dateTo = request.nextUrl.searchParams.get('dateTo')
  if (!dateFrom || !dateTo || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return NextResponse.json({ error: 'Parâmetros "dateFrom" e "dateTo" obrigatórios (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const jogos = await getOrFetch('jogos-fixtures-football-data', `${dateFrom}..${dateTo}`, TTL_JOGOS, () =>
      buscarJogosPorIntervalo(dateFrom, dateTo, AbortSignal.timeout(20_000)),
    )
    return NextResponse.json({ jogos })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
