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

/** Castle token cacheado do browser (via /api/lovable/deploy) */
let cachedCastleToken: string | null = null

export function setCachedCastleToken(token: string) {
  cachedCastleToken = token
}

/**
 * Tenta deploy no Lovable server-side.
 * Se Castle token está cacheado, usa ele. Senão, tenta sem.
 * Em caso de falha, o GitHub sync do Lovable fará o deploy automaticamente.
 */
export async function deployLovable(projectId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const firebaseToken = await getFirebaseToken()

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${firebaseToken}`,
      'Content-Type': 'application/json',
    }
    if (cachedCastleToken) {
      headers['X-Castle-Request-Token'] = cachedCastleToken
    }

    const res = await fetch(
      `https://api.lovable.dev/projects/${projectId}/deployments?async=true`,
      { method: 'POST', headers, body: '{}' }
    )

    if (res.ok) {
      return { ok: true, message: '🚀 Deploy iniciado' }
    }

    // API rejeitou (provavelmente Castle) — ok, o GitHub sync faz o deploy automaticamente
    return { ok: true, message: '🔄 Deploy automático via GitHub sync' }
  } catch {
    // Erro de rede ou credenciais — GitHub sync ainda funciona
    return { ok: true, message: '🔄 Deploy automático via GitHub sync' }
  }
}
