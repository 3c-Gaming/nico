import { NextRequest, NextResponse } from 'next/server'
import { getOrFetch } from '@/lib/cache'

const BASE_URL = 'https://api.sendpulse.com/whatsapp'
const API_KEY = process.env.SENDPULSE_API_KEY
const PAGE_SIZE = 1000
const TIMEOUT_MS = 15_000
const TTL_MS = 60_000

function getHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }
}

function inicioDoDia(): number {
  const agora = new Date()
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
}

async function fetchComTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { headers: getHeaders(), signal: signal ?? controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function contarContatosPorTag(botId: string, tag: string): Promise<number> {
  const inicio = inicioDoDia()
  let totalFiltrados = 0
  let skip = 0
  let temMais = true

  while (temMais) {
    const res = await fetchComTimeout(
      `${BASE_URL}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=${PAGE_SIZE}&skip=${skip}`
    )
    if (!res.ok) return 0

    const json = await res.json()
    const contatos: Record<string, unknown>[] = json.data ?? []
    const metaTotal: number = json.meta?.total ?? contatos.length

    for (const c of contatos) {
      if (typeof c.created_at === 'string') {
        const data = new Date(c.created_at).getTime()
        if (!isNaN(data) && data >= inicio) {
          totalFiltrados++
        }
      }
    }

    skip += PAGE_SIZE
    temMais = skip < metaTotal
  }

  return totalFiltrados
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { bots: { botId: string; tags: string[] }[] }
    if (!body.bots || !Array.isArray(body.bots)) {
      return NextResponse.json({ error: 'body.bots é obrigatório' }, { status: 400 })
    }

    const leads: Record<string, Record<string, number>> = {}

    for (const { botId, tags } of body.bots) {
      if (!botId || !tags?.length) continue
      leads[botId] = {}
      const resultados = await Promise.allSettled(
        tags.map(async (tag) => {
          const count = await getOrFetch('leads-hoje', `${botId}::${tag}`, TTL_MS, () =>
            contarContatosPorTag(botId, tag)
          )
          return { tag, count }
        })
      )
      for (const r of resultados) {
        if (r.status === 'fulfilled') {
          leads[botId][r.value.tag] = r.value.count
        }
      }
    }

    return NextResponse.json({ leads })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
