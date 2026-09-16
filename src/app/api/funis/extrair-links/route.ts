import { NextRequest, NextResponse } from 'next/server'
import { JSDOM } from 'jsdom'
import { listarCasas, listarLinkTemplates } from '@/lib/db/supabase'

export const maxDuration = 30

function hostnameDe(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * GET /api/funis/extrair-links?lpUrl=...&casaIds=id1,id2
 *
 * Busca o HTML da LP do funil e procura links (<a href>) cujo domínio bata com o urlTemplate já
 * cadastrado (Configurações > Casas/Templates) de alguma das casas vinculadas ao funil — best
 * effort pro botão "Buscar da LP" no painel de Detalhes. Nunca salva nada sozinho: só devolve
 * candidatos pra tela pré-preencher os campos de Link de Registro/Aposta, que o usuário ainda
 * confirma e salva manualmente (a LP pode ter mais de um link pro mesmo domínio — registro e
 * aposta direta, por exemplo — por isso devolve todos os candidatos, não um só palpite).
 */
export async function GET(request: NextRequest) {
  const lpUrl = request.nextUrl.searchParams.get('lpUrl')
  const casaIdsParam = request.nextUrl.searchParams.get('casaIds')
  if (!lpUrl) return NextResponse.json({ error: 'lpUrl é obrigatório' }, { status: 400 })
  const casaIds = (casaIdsParam ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (casaIds.length === 0) return NextResponse.json({ error: 'casaIds é obrigatório' }, { status: 400 })

  try {
    const [casas, templates] = await Promise.all([listarCasas(), listarLinkTemplates()])
    const dominiosPorCasa = new Map<string, Set<string>>()
    for (const template of templates) {
      if (!casaIds.includes(template.casaId)) continue
      const host = hostnameDe(template.urlTemplate)
      if (!host) continue
      if (!dominiosPorCasa.has(template.casaId)) dominiosPorCasa.set(template.casaId, new Set())
      dominiosPorCasa.get(template.casaId)!.add(host)
    }
    // Casa sem link template cadastrado ainda: usa o slug/nome como palpite de domínio (ex:
    // "superbet" -> superbet.com apareceria como candidato mesmo sem template salvo).
    for (const casa of casas) {
      if (!casaIds.includes(casa.id) || dominiosPorCasa.has(casa.id)) continue
      dominiosPorCasa.set(casa.id, new Set([casa.slug]))
    }

    const res = await fetch(lpUrl, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return NextResponse.json({ error: `LP respondeu ${res.status}` }, { status: 502 })
    const html = await res.text()
    const dom = new JSDOM(html)
    const hrefs = [...dom.window.document.querySelectorAll('a[href]')]
      .map((a) => {
        try {
          return new URL(a.getAttribute('href') ?? '', lpUrl).toString()
        } catch {
          return null
        }
      })
      .filter((h): h is string => !!h)

    const candidatos: Record<string, string[]> = {}
    for (const casaId of casaIds) {
      const dominios = dominiosPorCasa.get(casaId)
      if (!dominios) continue
      const encontrados = hrefs.filter((h) => {
        const host = hostnameDe(h)
        return host && [...dominios].some((d) => host.includes(d))
      })
      candidatos[casaId] = [...new Set(encontrados)]
    }

    return NextResponse.json({ candidatos })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
