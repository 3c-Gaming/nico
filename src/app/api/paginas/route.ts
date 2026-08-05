import { NextRequest, NextResponse } from 'next/server'
import {
  getGhToken, fetchFileFromGitHub,
  extractDestinations, extractText,
} from '@/lib/paginas/github-sync'

// --- Supabase CRUD para tabela "paginas" ---

/** Sincroniza destinations do GitHub pro Supabase para uma página recém-criada */
async function syncPageFromGitHub(pagina: any) {
  if (!pagina.tracking_file || !pagina.github_owner || !pagina.github_repo) return
  if (!['whatsapp', 'html_whatsapp'].includes(pagina.tipo)) return

  try {
    const token = await getGhToken()
    const content = await fetchFileFromGitHub(token, pagina.github_owner, pagina.github_repo, pagina.tracking_file)
    if (!content) return

    const destinations = extractDestinations(content)
    const text = extractText(content)
    if (destinations.length === 0) return

    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) return

    await (sb.from('paginas') as any).update({
      destinations,
      text: text || pagina.text,
      updated_at: new Date().toISOString(),
    }).eq('id', pagina.id)
  } catch { /* sync silencioso */ }
}

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
    // Auto-sync destinations do GitHub após inserir
    syncPageFromGitHub(data).catch(() => {})
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
    const { data, error } = await (sb.from('paginas') as any).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
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
