import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'
import { validarRcsContent } from '@/lib/rcs/template'
import type { RcsContent } from '@/lib/rcs/tipos'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
    .update({ nome, tipo: conteudo!.type, conteudo })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({
    template: { id: data.id, nome: data.nome, tipo: data.tipo, conteudo: data.conteudo, criadoEm: data.criado_em },
  })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 502 })

  const { error } = await supabase.from('rcs_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ deleted: true })
}
