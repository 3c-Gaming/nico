import { NextRequest, NextResponse } from 'next/server'
import type { CopaNoticia } from '@/types'

const RSS_URL = 'https://news.google.com/rss/search'

function extrairConteudoTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  if (!m) return ''
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function extrairAtributoTag(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["']`))
  return m ? m[1] : ''
}

function extrairItems(xml: string): string[] {
  const items: string[] = []
  const regex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1])
  }
  return items
}

function parseItem(itemXml: string): CopaNoticia | null {
  const titulo = extrairConteudoTag(itemXml, 'title')
  const link = extrairConteudoTag(itemXml, 'link')
  const data = extrairConteudoTag(itemXml, 'pubDate')
  const fonte = extrairConteudoTag(itemXml, 'source') || extrairConteudoTag(itemXml, 'media\\:credit')
  const fonteUrl = extrairAtributoTag(itemXml, 'source', 'url')

  if (!titulo || !link) return null

  return {
    titulo,
    link,
    fonte: fonte || 'Google Notícias',
    fonteUrl,
    data,
  }
}

let cache: { data: CopaNoticia[]; key: string; expiresAt: number } | null = null

export async function GET(request: NextRequest) {
  const team1 = request.nextUrl.searchParams.get('team1')
  const team2 = request.nextUrl.searchParams.get('team2')
  if (!team1 || !team2) {
    return NextResponse.json({ error: 'Parâmetros "team1" e "team2" obrigatórios' }, { status: 400 })
  }

  const cacheKey = `${team1}-${team2}`
  if (cache && cache.key === cacheKey && cache.expiresAt > Date.now()) {
    return NextResponse.json({ noticias: cache.data })
  }

  try {
    const query = encodeURIComponent(`${team1} ${team2} Copa do Mundo 2026`)
    const url = `${RSS_URL}?q=${query}&hl=pt-BR&gl=BR`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Next.js/16)',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Google News RSS HTTP ${res.status}` }, { status: 502 })
    }

    const xml = await res.text()
    const items = extrairItems(xml)
    const noticias: CopaNoticia[] = items
      .map(parseItem)
      .filter((n): n is CopaNoticia => n !== null)
      .slice(0, 8)

    cache = { data: noticias, key: cacheKey, expiresAt: Date.now() + 5 * 60 * 1000 }

    return NextResponse.json({ noticias })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
