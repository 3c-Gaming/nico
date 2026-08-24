import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function supabase(): any {
  const s = getSupabase()
  if (!s) throw new Error('Supabase não disponível')
  return s
}

/** Lista de "casas" (ex: superbet, superbet_odm, superbet_1k) monitoradas na seção de Bilhetes
 * de Aposta Pronta da tela de Testes — cada uma vira um GET em betting_links?casa=eq.<casa> (ver
 * @/lib/integrações/bettingLinks). Guardada na mesma linha singleton de bot_test_config já usada
 * pro resto da config de Testes (mesmo padrão de bot_contact_ids). */
export async function GET() {
  try {
    const { data } = await supabase().from('bot_test_config').select('bilhete_casas').eq('id', 1).maybeSingle()
    const casas = Array.isArray(data?.bilhete_casas) ? data.bilhete_casas : []
    return NextResponse.json({ casas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const casas = Array.isArray(body.casas) ? body.casas.map((c: unknown) => String(c).trim()).filter(Boolean) : null
    if (!casas) return NextResponse.json({ error: 'casas deve ser uma lista de strings' }, { status: 400 })

    const unicas = [...new Set(casas)]
    const { error } = await supabase().from('bot_test_config').upsert({
      id: 1,
      bilhete_casas: unicas,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ casas: unicas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
