import { NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:3333'

export async function GET() {
  try {
    const res = await fetch(BRIDGE_URL + '/qr', {
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
