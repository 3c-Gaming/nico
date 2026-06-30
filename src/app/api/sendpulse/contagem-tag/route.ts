import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://api.sendpulse.com/whatsapp'
const API_KEY = process.env.SENDPULSE_API_KEY

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag')
  const botId = request.nextUrl.searchParams.get('bot_id')

  if (!tag || !botId) {
    return NextResponse.json({ error: 'tag e bot_id são obrigatórios' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${BASE_URL}/contacts/getByTag?tag=${encodeURIComponent(tag)}&bot_id=${encodeURIComponent(botId)}&size=1000`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Sendpulse API error ${res.status}: ${text}` }, { status: 502 })
    }

    const json = await res.json()
    const contatos: unknown[] = json.data ?? []
    const total = json.meta?.total ?? contatos.length

    return NextResponse.json({ total })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
