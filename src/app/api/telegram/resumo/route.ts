import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

export interface ResumoCampanhaTelegram {
  total: number
  enviados: number
  falhas: number
}

const CACHE_TTL_MS = 30_000
let cache: { resumo: Record<string, ResumoCampanhaTelegram>; expiraEm: number } | null = null

/** GET /api/telegram/resumo — enviados/falhas por campanha, pra listagem de Disparos. Agrega
 * direto no Postgres (telegram_resumo_por_campanha(), GROUP BY) desde o primeiro dia — já
 * aprendemos com o SMS que trazer a tabela inteira pro Node pra somar em JS não escala. */
export async function GET() {
  if (cache && cache.expiraEm > Date.now()) {
    return NextResponse.json({ resumo: cache.resumo })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ resumo: {} })

  const { data, error } = await supabase.rpc('telegram_resumo_por_campanha')
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })

  const resumo: Record<string, ResumoCampanhaTelegram> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    resumo[r.campanha] = { total: r.total, enviados: r.enviados, falhas: r.falhas }
  }

  cache = { resumo, expiraEm: Date.now() + CACHE_TTL_MS }
  return NextResponse.json({ resumo })
}
