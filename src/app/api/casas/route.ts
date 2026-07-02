import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { listarCasas } = await import('@/lib/db/supabase')
    const casas = await listarCasas()
    return NextResponse.json({ casas })
  } catch {
    return NextResponse.json({ casas: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { criarCasa } = await import('@/lib/db/supabase')
    const body = await request.json()
    const casa = await criarCasa(body)
    return NextResponse.json({ casa })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { atualizarCasa } = await import('@/lib/db/supabase')
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    const casa = await atualizarCasa(id, updates)
    return NextResponse.json({ casa })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { deletarCasa } = await import('@/lib/db/supabase')
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    await deletarCasa(id)
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
