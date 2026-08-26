import { NextRequest, NextResponse } from 'next/server'
import { requireSupabase, listarAquecimentoPares, parFromRow } from '@/lib/aquecimento/db'

export async function GET() {
  try {
    const pares = await listarAquecimentoPares()
    return NextResponse.json({ pares })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (!body.botIdA || !body.botIdB) {
    return NextResponse.json({ error: 'botIdA e botIdB são obrigatórios' }, { status: 400 })
  }
  if (body.botIdA === body.botIdB) {
    return NextResponse.json({ error: 'um par precisa de dois números diferentes' }, { status: 400 })
  }
  try {
    const { data, error } = await requireSupabase()
      .from('aquecimento_pares')
      .insert({
        bot_id_a: body.botIdA,
        bot_id_b: body.botIdB,
        contact_id_a: body.contactIdA ?? null,
        contact_id_b: body.contactIdB ?? null,
        ativo: true,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ par: parFromRow(data) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
