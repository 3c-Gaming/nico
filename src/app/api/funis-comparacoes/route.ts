import { NextRequest, NextResponse } from 'next/server'
import type { FunilComparacao } from '@/types'

export async function GET() {
  try {
    const { listarFunisComparacoes } = await import('@/lib/db/supabase')
    const comparacoes = await listarFunisComparacoes()
    return NextResponse.json({ comparacoes })
  } catch {
    return NextResponse.json({ comparacoes: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { criarFunilComparacao } = await import('@/lib/db/supabase')
    const body = await request.json() as { titulo: string; flowIds: string[]; funis: string[]; inicio: string; fim: string }
    if (!body.titulo || !body.flowIds?.length || !body.inicio || !body.fim) {
      return NextResponse.json({ error: 'titulo, flowIds, inicio e fim são obrigatórios' }, { status: 400 })
    }
    const comparacao: FunilComparacao = {
      id: crypto.randomUUID(),
      titulo: body.titulo,
      flowIds: body.flowIds,
      funis: body.funis ?? [],
      inicio: body.inicio,
      fim: body.fim,
      criadoEm: new Date().toISOString(),
    }
    const criada = await criarFunilComparacao(comparacao)
    return NextResponse.json({ comparacao: criada })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { atualizarFunilComparacao } = await import('@/lib/db/supabase')
    const body = await request.json() as { id: string; titulo: string }
    if (!body.id || !body.titulo) {
      return NextResponse.json({ error: 'id e titulo são obrigatórios' }, { status: 400 })
    }
    const comparacao = await atualizarFunilComparacao(body.id, body.titulo)
    return NextResponse.json({ comparacao })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { deletarFunilComparacao } = await import('@/lib/db/supabase')
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    await deletarFunilComparacao(id)
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
