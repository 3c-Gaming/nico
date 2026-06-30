import { NextRequest, NextResponse } from 'next/server'
import { listarTags } from '@/lib/mcp/sendpulse'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 5 * 60_000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { bots: { botId: string; tags: string[] }[] }
    if (!body.bots || !Array.isArray(body.bots)) {
      return NextResponse.json({ error: 'body.bots é obrigatório' }, { status: 400 })
    }

    const contagens: Record<string, Record<string, number>> = {}

    for (const { botId, tags } of body.bots) {
      if (!botId || !tags?.length) continue
      contagens[botId] = {}

      try {
        const todas = await getOrFetch('tags', botId, TTL_MS, () => listarTags(botId))
        const mapa = new Map(todas.map(t => [t.name, t.contactCount]))
        for (const tag of tags) {
          contagens[botId][tag] = mapa.get(tag) ?? 0
        }
      } catch {
        for (const tag of tags) {
          contagens[botId][tag] = 0
        }
      }
    }

    return NextResponse.json({ contagens })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
