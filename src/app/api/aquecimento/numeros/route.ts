import { NextRequest, NextResponse } from 'next/server'
import { requireSupabase, listarAquecimentoNumeros, numeroFromRow } from '@/lib/aquecimento/db'

export async function GET() {
  try {
    const numeros = await listarAquecimentoNumeros()
    return NextResponse.json({ numeros })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (!body.botId || !body.contaId) {
    return NextResponse.json({ error: 'botId e contaId são obrigatórios' }, { status: 400 })
  }
  try {
    const { data, error } = await requireSupabase()
      .from('aquecimento_numeros')
      .upsert({
        bot_id: body.botId,
        conta_id: body.contaId,
        papel: body.papel === 'dedicado' ? 'dedicado' : 'normal',
        status: 'aquecendo',
        iniciado_em: new Date().toISOString(),
        notas: body.notas ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ numero: numeroFromRow(data) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
