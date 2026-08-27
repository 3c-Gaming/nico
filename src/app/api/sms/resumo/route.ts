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
const CACHE_TTL_MS = 30_000

interface EnvioResumo { campanha: string | null; status: string }
interface LinhaResumoSql { campanha: string; total: number; enviados: number; entregues: number; clicados: number; falhas: number }

let cache: { resumo: Record<string, ResumoCampanhaSms>; expiraEm: number } | null = null

/** Caminho rápido: agregação feita no Postgres via a função `sms_resumo_por_campanha()` (GROUP BY
 * direto no banco) — devolve uma linha por campanha em vez de trazer a tabela inteira pro Node.
 * Retorna null se a função ainda não existe (precisa rodar o SQL uma vez no Supabase), pra cair
 * no fallback abaixo sem quebrar o endpoint. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarViaRpc(supabase: any): Promise<Record<string, ResumoCampanhaSms> | null> {
  const { data, error } = await supabase.rpc('sms_resumo_por_campanha')
  if (error) return null
  const resumo: Record<string, ResumoCampanhaSms> = {}
  for (const r of (data ?? []) as LinhaResumoSql[]) {
    resumo[r.campanha] = { total: r.total, enviados: r.enviados, entregues: r.entregues, clicados: r.clicados, falhas: r.falhas }
  }
  return resumo
}

/** Fallback: busca todas as linhas de sms_envios, paginando, e agrega em JS — usado só quando a
 * função SQL (buscarViaRpc) ainda não existe no banco. Sem paginação, o PostgREST corta
 * silenciosamente em 1000 linhas (default do Supabase) e campanhas recentes somem do resumo
 * quando a tabela cresce além disso (confirmado ao vivo: campanha de 1000 SMS aparecendo com "1
 * entregue" porque campanhas antigas já ocupavam o teto de 1000 linhas da query).
 *
 * Ordena por (enviado_em, id) — sem uma ordem estável, paginar por offset enquanto a tabela
 * recebe inserts concorrentes pode pular ou repetir linhas entre uma página e outra. Com a
 * tabela já em 100k+ linhas (depois do incidente de reenvio duplicado), isso fica bem lento —
 * daí a função SQL acima ser o caminho preferido. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarViaPaginacao(supabase: any): Promise<Record<string, ResumoCampanhaSms>> {
  const todos: EnvioResumo[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from('sms_envios')
      .select('campanha, status')
      .order('enviado_em', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + TAMANHO_PAGINA - 1)
    if (error) throw new Error(error.message)
    todos.push(...(data ?? []))
    if (!data || data.length < TAMANHO_PAGINA) break
    offset += TAMANHO_PAGINA
  }

  const resumo: Record<string, ResumoCampanhaSms> = {}
  for (const envio of todos) {
    const campanha = envio.campanha
    if (!campanha) continue
    if (!resumo[campanha]) resumo[campanha] = { total: 0, enviados: 0, entregues: 0, clicados: 0, falhas: 0 }
    const r = resumo[campanha]
    r.total++
    if (STATUS_FALHA.has(envio.status)) {
      r.falhas++
    } else {
      r.enviados++
      if (STATUS_ENTREGUE.has(envio.status)) r.entregues++
      if (envio.status === 'clicked') r.clicados++
    }
  }
  return resumo
}

/** GET /api/sms/resumo — enviados/entregues/clicados/falhas por campanha, pra listagem de
 * Disparos (evita N chamadas, uma por campanha, ao renderizar a lista inteira).
 *
 * Cacheado por 30s em memória do processo — mesmo com a agregação no banco, evita bater no
 * Supabase de novo em navegações/re-renders próximos. Cache é por instância serverless, então
 * não é global nem garantido entre invocações frias. */
export async function GET() {
  if (cache && cache.expiraEm > Date.now()) {
    return NextResponse.json({ resumo: cache.resumo })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ resumo: {} })

  let resumo: Record<string, ResumoCampanhaSms> | null
  try {
    resumo = await buscarViaRpc(supabase)
    if (!resumo) resumo = await buscarViaPaginacao(supabase)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  cache = { resumo, expiraEm: Date.now() + CACHE_TTL_MS }

  return NextResponse.json({ resumo })
}
