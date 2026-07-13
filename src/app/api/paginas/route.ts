import { NextRequest, NextResponse } from 'next/server'

// --- Supabase CRUD para tabela "paginas" ---

export async function GET() {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) return NextResponse.json({ paginas: [] })
    const { data } = await sb.from('paginas').select('*').order('nome')
    return NextResponse.json({ paginas: data ?? [] })
  } catch {
    return NextResponse.json({ paginas: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 500 })
    const body = await request.json()
    const { data, error } = await sb.from('paginas').insert(body).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ pagina: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 500 })
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    const { data, error } = await sb.from('paginas').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ pagina: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 500 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    await sb.from('paginas').delete().eq('id', id)
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
