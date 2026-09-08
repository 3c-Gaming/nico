import { NextRequest, NextResponse } from 'next/server'
import { consultarStatusRcs } from '@/lib/integrações/solvefy'
import { getSupabase } from '@/lib/db/supabase'

const FALHA = ['erro', 'failed', 'undelivered']
// Estados que não mudam mais — para de reconsultar a Solvefy.
const STATUS_FINAIS = ['read', 'clicked', 'failed', 'undelivered', 'erro']
// Teto de reconsultas por clique no botão — bases grandes têm milhares de pendentes e o
// webhook é o caminho principal; isso aqui é só um empurrão.
const MAX_REPOLL = 300

/** GET /api/rcs/status?campanha=...&limit=N&falhas=1 — lê os envios registrados dessa campanha.
 * `limit` corta a lista (com `total` à parte); `falhas=1` traz só os que falharam. Colunas
 * enxutas — bases grandes não precisam do `select('*')`. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const campanha = sp.get('campanha')
  if (!campanha) return NextResponse.json({ error: 'campanha obrigatória' }, { status: 400 })
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 0, 0), 5000)
  const apenasFalhas = sp.get('falhas') === '1'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ envios: [], total: 0 })

  let countQ = supabase.from('rcs_envios').select('id', { count: 'exact', head: true }).eq('campanha', campanha)
  if (apenasFalhas) countQ = countQ.in('status', FALHA)
  const { count } = await countQ

  let q = supabase
    .from('rcs_envios')
    .select('telefone, status, clicado, erro, enviado_em')
    .eq('campanha', campanha)
    .order('enviado_em', { ascending: false })
  if (apenasFalhas) q = q.in('status', FALHA)
  if (limit > 0) q = q.limit(limit)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ envios: data ?? [], total: count ?? (data?.length ?? 0) })
}

/** POST /api/rcs/status { campanha } — reconsulta a Solvefy pros envios sem status final (até
 * MAX_REPOLL por vez) e atualiza. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const campanha = body.campanha as string | undefined
  if (!campanha) return NextResponse.json({ error: 'campanha obrigatória' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ envios: [], total: 0 })

  const { data: pendentes, error } = await supabase
    .from('rcs_envios')
    .select('id, solvefy_message_id')
    .eq('campanha', campanha)
    .not('status', 'in', `(${STATUS_FINAIS.map((s) => `"${s}"`).join(',')})`)
    .not('solvefy_message_id', 'is', null)
    .order('enviado_em', { ascending: true })
    .limit(MAX_REPOLL)

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })

  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pendentes ?? []).map(async (envio: any) => {
      const resultado = await consultarStatusRcs(envio.solvefy_message_id as string)
      if (resultado.ok && resultado.status) {
        await supabase
          .from('rcs_envios')
          .update({ status: resultado.status, atualizado_em: new Date().toISOString() })
          .eq('id', envio.id as string)
      }
    }),
  )

  const { count } = await supabase
    .from('rcs_envios')
    .select('id', { count: 'exact', head: true })
    .eq('campanha', campanha)
  const { data: atualizados } = await supabase
    .from('rcs_envios')
    .select('telefone, status, clicado, erro, enviado_em')
    .eq('campanha', campanha)
    .order('enviado_em', { ascending: false })
    .limit(1000)

  return NextResponse.json({ envios: atualizados ?? [], total: count ?? 0, reconsultados: pendentes?.length ?? 0 })
}
