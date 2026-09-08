import { NextRequest, NextResponse } from 'next/server'
import { consultarStatusRcs } from '@/lib/integrações/solvefy'
import { getSupabase } from '@/lib/db/supabase'

// Estados que não mudam mais — para de reconsultar a Solvefy.
const STATUS_FINAIS = ['read', 'failed', 'undelivered', 'erro']

/** GET /api/rcs/status?campanha=... — lê os envios já registrados dessa campanha (sem bater na
 * Solvefy). */
export async function GET(request: NextRequest) {
  const campanha = request.nextUrl.searchParams.get('campanha')
  if (!campanha) return NextResponse.json({ error: 'campanha obrigatória' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ envios: [] })

  const { data, error } = await supabase
    .from('rcs_envios')
    .select('*')
    .eq('campanha', campanha)
    .order('enviado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ envios: data ?? [] })
}

/** POST /api/rcs/status { campanha } — reconsulta a Solvefy pra cada envio sem status final e
 * atualiza a linha. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const campanha = body.campanha as string | undefined
  if (!campanha) return NextResponse.json({ error: 'campanha obrigatória' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ envios: [] })

  const { data: pendentes, error } = await supabase
    .from('rcs_envios')
    .select('*')
    .eq('campanha', campanha)
    .not('status', 'in', `(${STATUS_FINAIS.map((s) => `"${s}"`).join(',')})`)
    .not('solvefy_message_id', 'is', null)

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

  const { data: atualizados } = await supabase
    .from('rcs_envios')
    .select('*')
    .eq('campanha', campanha)
    .order('enviado_em', { ascending: false })

  return NextResponse.json({ envios: atualizados ?? [] })
}
