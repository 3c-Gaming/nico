import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://api.sendpulse.com/whatsapp'
const API_KEY = process.env.SENDPULSE_API_KEY

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')
  if (!botId) {
    return NextResponse.json({ error: 'bot_id é obrigatório' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${BASE_URL}/chats?bot_id=${encodeURIComponent(botId)}&size=3`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Sendpulse error ${res.status}: ${text}` }, { status: 502 })
    }

    const json = await res.json()
    const chats = json.data ?? []

    const debug = chats.map((chat: Record<string, unknown>) => ({
      contactId: (chat.contact as Record<string, unknown> | undefined)?.id,
      inbox_last_message: chat.inbox_last_message,
      inbox_unread: chat.inbox_unread,
      is_chat_opened: chat.is_chat_opened,
    }))

    return NextResponse.json({
      total: json.meta?.total,
      sample: debug,
      raw_first: chats[0] ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
