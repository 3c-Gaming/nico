const FIREBASE_API_KEY = process.env.LOVABLE_FIREBASE_API_KEY
const REFRESH_TOKEN = process.env.LOVABLE_REFRESH_TOKEN

let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function getFirebaseToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken
  }
  if (!FIREBASE_API_KEY || !REFRESH_TOKEN) throw new Error('Credenciais Lovable não configuradas')
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`,
  })
  if (!res.ok) throw new Error(`Firebase token error: ${res.status}`)
  const data = await res.json()
  cachedToken = {
    accessToken: data.access_token || data.id_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  }
  return cachedToken.accessToken
}

/**
 * Faz deploy no Lovable server-side (sem Castle.js).
 * Retorna resultado ou erro.
 */
export async function deployLovable(projectId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await getFirebaseToken()
    const res = await fetch(
      `https://api.lovable.dev/projects/${projectId}/deployments?async=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )
    const text = await res.text()
    if (res.ok) {
      return { ok: true, message: '🚀 Deploy iniciado' }
    }
    return { ok: false, message: `Deploy falhou: ${res.status}` }
  } catch (err) {
    return { ok: false, message: `Deploy erro: ${(err as Error).message}` }
  }
}
