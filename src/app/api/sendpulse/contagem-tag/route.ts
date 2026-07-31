import { NextRequest, NextResponse } from 'next/server'
import { comContaDoBot } from '@/lib/integrações/contasSendpulse'

const BASE_URL = 'https://api.sendpulse.com/whatsapp'

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag')
  const botId = request.nextUrl.searchParams.get('bot_id')

  if (!tag || !botId) {
    return NextResponse.json({ error: 'tag e bot_id são obrigatórios' }, { status: 400 })
  }

  try {
    const total = await comContaDoBot(botId, async (apiKey) => {
      const res = await fetch(
        `${BASE_URL}/contacts/getByTag?tag=${encodeURIComponent(tag)}&bot_id=${encodeURIComponent(botId)}&size=1000`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        }
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Sendpulse API error ${res.status}: ${text}`)
      }
      const json = await res.json()
      const contatos: unknown[] = json.data ?? []
      return json.meta?.total ?? contatos.length
    })

    return NextResponse.json({ total })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
