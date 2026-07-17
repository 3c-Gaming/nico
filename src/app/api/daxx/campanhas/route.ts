import { NextResponse } from 'next/server'
import { getOrFetch } from '@/lib/cache'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'
const TTL_MS = 5 * 60 * 1000
const STALE_MULTIPLIER = 6

export async function GET() {
  try {
    const data = await getOrFetch('daxx', 'campanhas', TTL_MS, async () => {
      const res = await fetch(BRIDGE_URL + '/campanhas', {
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `bridge error ${res.status}`)
      }
      const json = await res.json()
      if (!json.campanhas || !json.campanhas.length) {
        throw new Error('bridge returned empty campaigns')
      }
      return json
    }, STALE_MULTIPLIER)

    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/daxx/campanhas]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message, campanhas: [] }, { status: 502 })
  }
}
