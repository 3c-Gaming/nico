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

/** GET /api/sms/resumo — enviados/entregues/clicados/falhas por campanha, pra listagem de
 * Disparos (evita N chamadas, uma por campanha, ao renderizar a lista inteira). */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ resumo: {} })

  const { data, error } = await supabase.from('sms_envios').select('campanha, status')
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })

  const resumo: Record<string, ResumoCampanhaSms> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const envio of (data ?? []) as any[]) {
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
