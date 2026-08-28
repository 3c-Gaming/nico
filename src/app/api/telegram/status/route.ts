import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

/** GET /api/telegram/status?campanha=... — lista os envios já registrados dessa campanha.
 * Diferente do SMS, não tem um POST de "atualizar status": o Telegram sendMessage responde na
 * hora se foi aceito ou não, não existe confirmação de entrega assíncrona pra reconsultar depois. */
export async function GET(request: NextRequest) {
  const campanha = request.nextUrl.searchParams.get('campanha')
  if (!campanha) return NextResponse.json({ error: 'campanha obrigatória' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ envios: [] })

  const { data, error } = await supabase
    .from('telegram_envios')
    .select('*')
    .eq('campanha', campanha)
    .order('enviado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ envios: data ?? [] })
}
