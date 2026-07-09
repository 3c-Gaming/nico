import { NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const res = await fetch(BRIDGE_URL + '/campanhas/' + encodeURIComponent(id) + '/template', {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(txt || 'bridge error ' + res.status)
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/daxx/template]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
