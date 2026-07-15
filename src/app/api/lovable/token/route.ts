import { NextResponse } from 'next/server'

const FIREBASE_API_KEY = process.env.LOVABLE_FIREBASE_API_KEY
const REFRESH_TOKEN = process.env.LOVABLE_REFRESH_TOKEN

let cachedToken: { accessToken: string; expiresAt: number } | null = null

export async function GET() {
  try {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
      return NextResponse.json({ token: cachedToken.accessToken })
    }

    if (!FIREBASE_API_KEY || !REFRESH_TOKEN) {
      return NextResponse.json({ error: 'Credenciais não configuradas' }, { status: 500 })
    }

    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`,
      }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Firebase: ${res.status} ${text}` }, { status: 500 })
    }

    const data = await res.json()
    cachedToken = {
      accessToken: data.access_token || data.id_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    }

    return NextResponse.json({ token: cachedToken.accessToken })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
