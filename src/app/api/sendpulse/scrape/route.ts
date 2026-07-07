import { NextRequest, NextResponse } from 'next/server'
import type { ScrapeResultado } from '@/lib/scraper/types'

const CACHE_TTL = 15_000
let cache: { data: ScrapeResultado; expires: number } | null = null

export async function GET() {
  if (cache && Date.now() < cache.expires) {
    return NextResponse.json(cache.data)
  }

  try {
    const numerosRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sendpulse/numeros`)
    const numerosData = await numerosRes.json()
    const bots = (numerosData.numeros || numerosData || []).map((n: { id: string; numero: string }) => ({
      id: n.id,
      numero: n.numero,
    }))

    if (!bots.length) throw new Error('Nenhum numero disponivel para scraping')

    const { scrapeNumeros } = await import('@/lib/scraper/sendpulse-scraper')

    const resultado = await Promise.race([
      scrapeNumeros(bots),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Scraping timeout apos 60s')), 60_000)
      ),
    ])

    cache = { data: resultado, expires: Date.now() + CACHE_TTL }
    return NextResponse.json(resultado)
  } catch (err) {
    const fallbackRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sendpulse/live-chat`)
    const fallbackData = await fallbackRes.json()
    return NextResponse.json({ ...fallbackData, scrapeFallback: true, scrapeErro: (err as Error).message })
  }
}
