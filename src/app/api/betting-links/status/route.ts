import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'
import { buscarBilhetesAtivos } from '@/lib/integrações/bettingLinks'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function supabase(): any {
  const s = getSupabase()
  if (!s) throw new Error('Supabase não disponível')
  return s
}

export const maxDuration = 30

/** Dispara o GET de betting_links pra cada casa configurada (ver /api/betting-links/casas) em
 * paralelo — uma casa falhando (ex: nome errado) não derruba as outras. */
export async function GET() {
  try {
    const { data, error } = await supabase().from('bot_test_config').select('bilhete_casas').eq('id', 1).maybeSingle()
    if (error) throw new Error(error.message)
    const casas: string[] = Array.isArray(data?.bilhete_casas) ? data.bilhete_casas : []

    const resultados = await Promise.all(
      casas.map(async (casa) => {
        try {
          const bilhetes = await buscarBilhetesAtivos(casa, AbortSignal.timeout(10_000))
          return { casa, bilhetes, erro: null as string | null }
        } catch (err) {
          return { casa, bilhetes: [], erro: (err as Error).message }
        }
      }),
    )

    return NextResponse.json({ resultados })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
