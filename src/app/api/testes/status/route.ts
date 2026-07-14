import { NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:3333'

export async function GET() {
  try {
    const res = await fetch(BRIDGE_URL + '/status', {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error('bridge error ' + res.status)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { connected: false, number: undefined, qrNeeded: false, lastDisconnectReason: undefined },
      { status: 200 }
    )
  }
}
