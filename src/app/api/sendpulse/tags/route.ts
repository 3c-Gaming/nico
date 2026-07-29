import { NextRequest, NextResponse } from 'next/server'
import { listarTags } from '@/lib/mcp/sendpulse'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 5 * 60_000

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('botId')
  if (!botId) {
    return NextResponse.json({ error: 'botId é obrigatório' }, { status: 400 })
  }

  try {
    const tags = await getOrFetch('sendpulse-tags-por-bot', botId, TTL_MS, () => listarTags(botId))
    return NextResponse.json({ tags })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
