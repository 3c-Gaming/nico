import { NextRequest, NextResponse } from 'next/server'
import { consultarStatusSms } from '@/lib/integrações/solvefy'
import { getSupabase } from '@/lib/db/supabase'

// Valor real de `status` na resposta da Solvefy vem sem prefixo (ex: "delivered", não
// "message.delivered" — esse prefixo é só o nome do evento de webhook, confirmado testando
// GET /cpaas/v1/sms/messages/{id} ao vivo).
const STATUS_FINAIS = ['delivered', 'undelivered', 'failed', 'erro']

/** GET /api/sms/status?campanha=... — lista os envios já registrados dessa campanha (sem bater
 * na Solvefy de novo, só lê o que já está salvo). */
export async function GET(request: NextRequest) {
  const campanha = request.nextUrl.searchParams.get('campanha')
  if (!campanha) return NextResponse.json({ error: 'campanha obrigatória' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ envios: [] })

  const { data, error } = await supabase
    .from('sms_envios')
    .select('*')
    .eq('campanha', campanha)
    .order('enviado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ envios: data ?? [] })
}

/** POST /api/sms/status { campanha } — pra cada envio dessa campanha ainda sem status final,
 * reconsulta a Solvefy e atualiza a linha. Chamado pelo botão "Atualizar status" no front. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const campanha = body.campanha as string | undefined
  if (!campanha) return NextResponse.json({ error: 'campanha obrigatória' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ envios: [] })

  const { data: pendentes, error } = await supabase
    .from('sms_envios')
    .select('*')
    .eq('campanha', campanha)
    .not('status', 'in', `(${STATUS_FINAIS.map((s) => `"${s}"`).join(',')})`)
    .not('solvefy_message_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })

  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pendentes ?? []).map(async (envio: any) => {
      const resultado = await consultarStatusSms(envio.solvefy_message_id as string)
      if (resultado.ok && resultado.status) {
        await supabase
          .from('sms_envios')
          .update({ status: resultado.status, atualizado_em: new Date().toISOString() })
          .eq('id', envio.id as string)
      }
    }),
  )

  const { data: atualizados } = await supabase
    .from('sms_envios')
    .select('*')
    .eq('campanha', campanha)
    .order('enviado_em', { ascending: false })

  return NextResponse.json({ envios: atualizados ?? [] })
}
