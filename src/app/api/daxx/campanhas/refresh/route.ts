import { NextResponse } from 'next/server'
import { invalidate } from '@/lib/cache'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

export async function GET() {
  try {
    invalidate('daxx', 'campanhas')
    const res = await fetch(BRIDGE_URL + '/campanhas/refresh', {
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(txt || `bridge error ${res.status}`)
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/daxx/campanhas/refresh]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message, campanhas: [] }, { status: 502 })
  }
}
