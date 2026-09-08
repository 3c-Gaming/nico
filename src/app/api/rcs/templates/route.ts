import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'
import { validarRcsContent } from '@/lib/rcs/template'
import type { RcsContent } from '@/lib/rcs/tipos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any) {
  return { id: r.id, nome: r.nome, tipo: r.tipo, conteudo: r.conteudo, criadoEm: r.criado_em }
}

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ templates: [] })

  const { data, error } = await supabase
    .from('rcs_templates')
    .select('*')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ templates: (data ?? []).map(fromRow) })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const nome = String(body.nome ?? '').trim()
  const conteudo = body.conteudo as RcsContent | undefined

  if (!nome) return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })
  const erros = validarRcsContent(conteudo)
  if (erros.length) return NextResponse.json({ error: erros.join('; ') }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 502 })

  const { data, error } = await supabase
    .from('rcs_templates')
    .insert({ nome, tipo: conteudo!.type, conteudo })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ template: fromRow(data) })
}
