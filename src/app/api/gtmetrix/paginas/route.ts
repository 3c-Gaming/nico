import { NextResponse } from 'next/server'

const MAX_URLS = 20

function normalizar(entrada: unknown): string | null {
  if (typeof entrada !== 'string') return null
  let u = entrada.trim()
  if (!u) return null
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!parsed.hostname.includes('.')) return null
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const { getGtmetrixUrls } = await import('@/lib/db/supabase')
    const { URLS_GTMETRIX_SEED } = await import('@/lib/gtmetrix/paginas')
    const { urls, configurado } = await getGtmetrixUrls()
    return NextResponse.json({ urls: configurado ? urls : URLS_GTMETRIX_SEED, configurado })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { salvarGtmetrixUrls } = await import('@/lib/db/supabase')
    const body = await request.json()
    const entradas: unknown[] = Array.isArray(body?.urls) ? body.urls : []

    const invalidas: string[] = []
    const validas: string[] = []
    for (const e of entradas) {
      const n = normalizar(e)
      if (n) validas.push(n)
      else if (typeof e === 'string' && e.trim()) invalidas.push(e.trim())
    }

    if (invalidas.length) {
      return NextResponse.json(
        { error: `Link(s) inválido(s): ${invalidas.join(', ')}` },
        { status: 400 },
      )
    }
    if (validas.length > MAX_URLS) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_URLS} páginas (cada rodada gasta 1 crédito GTmetrix por página).` },
        { status: 400 },
      )
    }

    const salvo = await salvarGtmetrixUrls(validas)
    return NextResponse.json({ urls: salvo, configurado: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
