import { NextRequest, NextResponse } from 'next/server'

const SWITCHY_API = 'https://api.switchy.io/v1/links/create'
const API_KEY = process.env.SWITCHY_API_KEY

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'SWITCHY_API_KEY não configurada' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { url, slug, title } = body as {
      url: string
      slug?: string
      title?: string
    }

    if (!url) {
      return NextResponse.json({ error: '"url" é obrigatório' }, { status: 400 })
    }

    const linkPayload: Record<string, unknown> = { url }
    if (slug) linkPayload.id = slug
    if (title) linkPayload.title = title

    const payload = {
      link: linkPayload,
      autofill: true,
    }

    const res = await fetch(SWITCHY_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Switchy HTTP ${res.status}: ${text}` }, { status: 502 })
    }

    const json = await res.json()
    const shortUrl = json?.link?.url ?? json?.short_url ?? json?.shortUrl ?? ''

    return NextResponse.json({
      shortUrl,
      id: json?.link?.id ?? json?.id ?? '',
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
