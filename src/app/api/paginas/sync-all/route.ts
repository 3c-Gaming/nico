import { NextResponse } from 'next/server'
import {
  getGhToken, fetchFileFromGitHub,
  extractDestinations, extractText,
} from '@/lib/paginas/github-sync'

// POST - Sincroniza destinations de TODAS as páginas whatsapp/html_whatsapp do GitHub pro Supabase
export async function POST() {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 500 })

    const token = await getGhToken()
    const { data: paginas } = await sb.from('paginas').select('*').order('nome') as { data: any[] | null }
    if (!paginas?.length) return NextResponse.json({ synced: 0, skipped: 0, errors: [] })

    let synced = 0, skipped = 0
    const errors: string[] = []

    for (const p of paginas) {
      if (!p.tracking_file || !p.github_owner || !p.github_repo) { skipped++; continue }
      if (!['whatsapp', 'html_whatsapp'].includes(p.tipo)) { skipped++; continue }

      try {
        const content = await fetchFileFromGitHub(token, p.github_owner, p.github_repo, p.tracking_file)
        if (!content) { skipped++; continue }

        const destinations = extractDestinations(content)
        const text = extractText(content)
        if (destinations.length === 0) { skipped++; continue }

        // Só atualiza se mudou
        if (JSON.stringify(p.destinations ?? []) === JSON.stringify(destinations) && p.text === text) {
          skipped++; continue
        }

        const { error } = await (sb.from('paginas') as any).update({
          destinations,
          text: text || p.text,
          updated_at: new Date().toISOString(),
        }).eq('id', p.id)

        if (error) { errors.push(`${p.nome}: ${error.message}`) }
        else { synced++ }
      } catch (err: any) {
        errors.push(`${p.nome}: ${err?.message}`)
      }
    }

    return NextResponse.json({ synced, skipped, errors })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro ao sincronizar' }, { status: 500 })
  }
}
