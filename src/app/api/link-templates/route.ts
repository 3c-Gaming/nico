import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { listarLinkTemplates } = await import('@/lib/db/supabase')
    const templates = await listarLinkTemplates()
    return NextResponse.json({ templates })
  } catch {
    return NextResponse.json({ templates: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { criarLinkTemplate } = await import('@/lib/db/supabase')
    const body = await request.json()
    const template = await criarLinkTemplate(body)
    return NextResponse.json({ template })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { atualizarLinkTemplate } = await import('@/lib/db/supabase')
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    const template = await atualizarLinkTemplate(id, updates)
    return NextResponse.json({ template })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { deletarLinkTemplate } = await import('@/lib/db/supabase')
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    await deletarLinkTemplate(id)
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
