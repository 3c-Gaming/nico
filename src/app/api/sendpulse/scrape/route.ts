import { NextResponse } from 'next/server'
import type { DadosMonitoramento, NumeroMonitorado, NumeroSendpulse, StatusInteracao } from '@/types'

const CACHE_TTL = 15_000
let cache: { data: DadosMonitoramento; expires: number } | null = null

export async function GET() {
  if (cache && Date.now() < cache.expires) {
    return NextResponse.json(cache.data)
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const numerosRes = await fetch(appUrl + '/api/sendpulse/numeros')
    const numerosData = await numerosRes.json()
    const numerosSendpulse: NumeroSendpulse[] = numerosData.numeros || numerosData || []

    if (!numerosSendpulse.length) throw new Error('Nenhum numero disponivel para scraping')

    const { scrapeNumeros } = await import('@/lib/scraper/sendpulse-function')

    const bots = numerosSendpulse.map(n => ({ id: n.id, numero: n.numero }))
    const scrapeResultado = await scrapeNumeros(bots)

    const todosFalharam = !scrapeResultado.numeros.length ||
      scrapeResultado.numeros.every(n => n.erro)
    if (todosFalharam) throw new Error('Todos os numeros falharam no scrape')

    const scrapeMap = new Map(scrapeResultado.numeros.map(r => [r.botId, r]))

    const dados: DadosMonitoramento = {
      ultimaAtualizacao: new Date().toISOString(),
      numeros: numerosSendpulse.map(bot => {
        const s = scrapeMap.get(bot.id)
        return {
          numero: bot,
          chats: [],
          totalConversas: s?.chatsAtivos ?? 0,
          leadsHoje: 0,
          totalNaoLidas: 0,
          volumeUltimos5Min: s?.volume5min ?? 0,
          volumeUltimaHora: 0,
          volumeHoje: 0,
          volumeOutbox5Min: 0,
          chatsScanned: s?.chatsAtivos ?? 0,
          chatsTotal: s?.chatsAtivos ?? 0,
          totalMensagensEnviadas: 0,
          totalFluxos: 0,
          statusInteracao: s?.status as StatusInteracao | undefined,
          ultimoAumentoMs: undefined,
        } satisfies NumeroMonitorado
      }),
    }

    cache = { data: dados, expires: Date.now() + CACHE_TTL }
    return NextResponse.json(dados)
  } catch (err) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const fallbackRes = await fetch(appUrl + '/api/sendpulse/live-chat')
    const fallbackData = await fallbackRes.json()
    return NextResponse.json({ ...fallbackData, scrapeFallback: true, scrapeErro: (err as Error).message })
  }
}
