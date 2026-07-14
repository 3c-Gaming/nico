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
    throw new Error(`Erro ao renovar token Lovable: ${res.status} ${text}`)
  }

  const data = await res.json()
  cachedToken = {
    accessToken: data.access_token || data.id_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  }

  return cachedToken.accessToken
}

export async function deployLovable(projectId: string): Promise<{ url: string; deploymentId: string }> {
  const token = await getAccessToken()

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

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Deploy Lovable falhou: ${res.status} ${text}`)
  }

  const data = await res.json()
  return {
    url: data.url || '',
    deploymentId: data.deployment_id || '',
  }
}
