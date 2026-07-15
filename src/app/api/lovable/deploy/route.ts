import { NextResponse } from 'next/server'

const FIREBASE_API_KEY = process.env.LOVABLE_FIREBASE_API_KEY
const REFRESH_TOKEN = process.env.LOVABLE_REFRESH_TOKEN

let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken
  }

  if (!FIREBASE_API_KEY || !REFRESH_TOKEN) {
    throw new Error('LOVABLE_FIREBASE_API_KEY e LOVABLE_REFRESH_TOKEN não configurados')
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
    throw new Error(`Erro ao renovar token: ${res.status} ${text}`)
  }

  const data = await res.json()
  cachedToken = {
    accessToken: data.access_token || data.id_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  }

  return cachedToken.accessToken
}

export async function POST(req: Request) {
  try {
    const { projectId, castleToken } = await req.json()
    if (!projectId || !castleToken) {
      return NextResponse.json({ error: 'projectId e castleToken obrigatórios' }, { status: 400 })
    }

    const token = await getAccessToken()

    const res = await fetch(
      `https://api.lovable.dev/projects/${projectId}/deployments?async=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Castle-Request-Token': castleToken,
        },
        body: '{}',
      }
    )

    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json({ error: text }, { status: res.status })
    }

    const data = JSON.parse(text)
    return NextResponse.json({ ok: true, url: data.url, deploymentId: data.deployment_id })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
