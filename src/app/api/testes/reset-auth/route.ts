import { NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:3333'

export async function POST() {
  try {
    const res = await fetch(BRIDGE_URL + '/reset-auth', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 502 })
  }
}
