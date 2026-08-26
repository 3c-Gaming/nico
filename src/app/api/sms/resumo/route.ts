import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

export interface ResumoCampanhaSms {
  total: number
  enviados: number
  entregues: number
  clicados: number
  falhas: number
}

const STATUS_FALHA = new Set(['erro', 'failed', 'undelivered'])
const STATUS_ENTREGUE = new Set(['delivered', 'clicked'])

const TAMANHO_PAGINA = 1000

/** Busca todas as linhas de sms_envios, paginando — sem isso o PostgREST corta silenciosamente em
 * 1000 linhas (default do Supabase) e campanhas mais recentes somem do resumo quando a tabela
 * cresce além disso (confirmado ao vivo: campanha de 1000 SMS aparecendo com "1 entregue" porque
 * campanhas antigas já ocupavam o teto de 1000 linhas da query). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarTodosEnvios(supabase: any): Promise<{ campanha: string | null; status: string }[]> {
  const todos: { campanha: string | null; status: string }[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from('sms_envios')
      .select('campanha, status')
      .range(offset, offset + TAMANHO_PAGINA - 1)
    if (error) throw new Error(error.message)
    todos.push(...(data ?? []))
    if (!data || data.length < TAMANHO_PAGINA) break
    offset += TAMANHO_PAGINA
  }
  return todos
}

/** GET /api/sms/resumo — enviados/entregues/clicados/falhas por campanha, pra listagem de
 * Disparos (evita N chamadas, uma por campanha, ao renderizar a lista inteira). */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ resumo: {} })

  let data: { campanha: string | null; status: string }[]
  try {
    data = await buscarTodosEnvios(supabase)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  const resumo: Record<string, ResumoCampanhaSms> = {}
  for (const envio of data) {
    const campanha = envio.campanha as string | null
    if (!campanha) continue
    if (!resumo[campanha]) resumo[campanha] = { total: 0, enviados: 0, entregues: 0, clicados: 0, falhas: 0 }
    const r = resumo[campanha]
    r.total++
    const status = envio.status as string
    if (STATUS_FALHA.has(status)) {
      r.falhas++
    } else {
      r.enviados++
      if (STATUS_ENTREGUE.has(status)) r.entregues++
      if (status === 'clicked') r.clicados++
    }
  }

  return NextResponse.json({ resumo })
}
