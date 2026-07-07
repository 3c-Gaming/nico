import { NextResponse } from 'next/server'
import type { ScrapeResultado } from '@/lib/scraper/types'

const CACHE_TTL = 15_000
let cache: { data: ScrapeResultado; expires: number } | null = null

export async function GET() {
  if (cache && Date.now() < cache.expires) {
    return NextResponse.json(cache.data)
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const numerosRes = await fetch(appUrl + '/api/sendpulse/numeros')
    const numerosData = await numerosRes.json()
    const bots = (numerosData.numeros || numerosData || []).map(function(n: { id: string; numero: string }) {
      return { id: n.id, numero: n.numero }
    })

    if (!bots.length) throw new Error('Nenhum numero disponivel para scraping')

    const { scrapeNumeros } = await import('@/lib/scraper/sendpulse-function')

    const resultado = await scrapeNumeros(bots)

    const todosFalharam = !resultado.numeros.length || resultado.numeros.every(n => n.erro)
    if (todosFalharam) throw new Error('Todos os numeros falharam no scrape')

    cache = { data: resultado, expires: Date.now() + CACHE_TTL }
    return NextResponse.json(resultado)
  } catch (err) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const fallbackRes = await fetch(appUrl + '/api/sendpulse/live-chat')
    const fallbackData = await fallbackRes.json()
    return NextResponse.json({ ...fallbackData, scrapeFallback: true, scrapeErro: (err as Error).message })
  }
}
