import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'
import { validarRcsContent, validarFallback } from '@/lib/rcs/template'
import type { RcsContent, RcsSmsFallback } from '@/lib/rcs/tipos'

function normalizarFallback(f: unknown): RcsSmsFallback | null {
  if (!f || typeof f !== 'object') return null
  const o = f as Record<string, unknown>
  if (!o.enabled) return null
  return { enabled: true, from: String(o.from ?? '').trim(), text: String(o.text ?? '') }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const nome = String(body.nome ?? '').trim()
  const conteudo = body.conteudo as RcsContent | undefined
  const fallback = normalizarFallback(body.fallback)

  if (!nome) return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })
  const erros = [...validarRcsContent(conteudo), ...validarFallback(fallback)]
  if (erros.length) return NextResponse.json({ error: erros.join('; ') }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 502 })

  const { data, error } = await supabase
    .from('rcs_templates')
    .update({ nome, tipo: conteudo!.type, conteudo, fallback })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({
    template: { id: data.id, nome: data.nome, tipo: data.tipo, conteudo: data.conteudo, fallback: data.fallback ?? null, criadoEm: data.criado_em },
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
