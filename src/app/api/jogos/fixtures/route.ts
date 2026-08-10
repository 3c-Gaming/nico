import { NextRequest, NextResponse } from 'next/server'
import { buscarJogosPorData, PlanoRestritoError } from '@/lib/integrações/footballApi'
import { getOrFetch } from '@/lib/cache'
import { hojeBrasilISO } from '@/lib/datas'
import type { Jogo } from '@/types'

const UM_DIA = 24 * 60 * 60 * 1000

interface ResultadoFixtures {
  jogos: Jogo[]
  bloqueadoPeloPlano?: boolean
}

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
    // Datas bloqueadas pelo plano viram um resultado cacheável igual a qualquer outro — assim
    // não gastamos request de novo pra descobrir de novo que aquela data continua bloqueada.
    // Prefixo "v2": o formato do valor cacheado mudou de Jogo[] pra {jogos, bloqueadoPeloPlano} —
    // sem trocar a chave, entradas antigas ainda dentro do TTL voltariam no formato velho e
    // quebrariam a leitura (json.jogos undefined) até expirar sozinhas.
    const resultado = await getOrFetch<ResultadoFixtures>('jogos-fixtures-v2', date, ttlParaData(date), async () => {
      try {
        const jogos = await buscarJogosPorData(date, AbortSignal.timeout(20_000))
        return { jogos }
      } catch (err) {
        if (err instanceof PlanoRestritoError) return { jogos: [], bloqueadoPeloPlano: true }
        throw err
      }
    })
    return NextResponse.json(resultado)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
