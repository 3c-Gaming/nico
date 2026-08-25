import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ templates: [] })

  const { data, error } = await supabase
    .from('sms_templates')
    .select('*')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (!body.nome || !body.corpo) {
    return NextResponse.json({ error: 'nome e corpo são obrigatórios' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 502 })

  const { data, error } = await supabase
    .from('sms_templates')
    .insert({ nome: body.nome, corpo: body.corpo })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ template: data })
}
