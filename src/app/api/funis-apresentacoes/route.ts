import { NextRequest, NextResponse } from 'next/server'
import type { FunilApresentacao } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { buscarFunilApresentacao } = await import('@/lib/db/supabase')
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    const apresentacao = await buscarFunilApresentacao(id)
    if (!apresentacao) return NextResponse.json({ error: 'Apresentação não encontrada' }, { status: 404 })
    return NextResponse.json({ apresentacao })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Erro' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { criarFunilApresentacao } = await import('@/lib/db/supabase')
    const body = await request.json() as { titulo: string; flowId: string; funil: string; inicio: string; fim: string }
    if (!body.titulo || !body.flowId || !body.inicio || !body.fim) {
      return NextResponse.json({ error: 'titulo, flowId, inicio e fim são obrigatórios' }, { status: 400 })
    }
    const agora = new Date().toISOString()
    const apresentacao: FunilApresentacao = {
      id: crypto.randomUUID(),
      titulo: body.titulo,
      flowId: body.flowId,
      funil: body.funil ?? '',
      inicio: body.inicio,
      fim: body.fim,
      comentarios: '',
      criadoEm: agora,
      atualizadoEm: agora,
    }
    const criada = await criarFunilApresentacao(apresentacao)
    return NextResponse.json({ apresentacao: criada })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Erro' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { atualizarComentariosFunilApresentacao } = await import('@/lib/db/supabase')
    const body = await request.json() as { id: string; comentarios: string }
    if (!body.id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    const apresentacao = await atualizarComentariosFunilApresentacao(body.id, body.comentarios ?? '')
    if (!apresentacao) return NextResponse.json({ error: 'Apresentação não encontrada' }, { status: 404 })
    return NextResponse.json({ apresentacao })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Erro' }, { status: 500 })
  }
}
