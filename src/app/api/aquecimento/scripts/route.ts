import { NextRequest, NextResponse } from 'next/server'
import { requireSupabase, listarAquecimentoScripts, scriptFromRow } from '@/lib/aquecimento/db'
import type { AquecimentoMensagemScript } from '@/types'

function validarMensagens(mensagens: unknown): mensagens is AquecimentoMensagemScript[] {
  if (!Array.isArray(mensagens) || mensagens.length === 0) return false
  return mensagens.every((m) => m && (m.de === 'A' || m.de === 'B') && typeof m.texto === 'string' && m.texto.trim())
}

export async function GET() {
  try {
    const scripts = await listarAquecimentoScripts()
    return NextResponse.json({ scripts })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (!body.nome || !validarMensagens(body.mensagens)) {
    return NextResponse.json({ error: 'nome e mensagens (array de {de: "A"|"B", texto}) são obrigatórios' }, { status: 400 })
  }
  try {
    const { data, error } = await requireSupabase()
      .from('aquecimento_scripts')
      .insert({ nome: body.nome, tema: body.tema ?? null, mensagens: body.mensagens, ativo: true })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ script: scriptFromRow(data) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
