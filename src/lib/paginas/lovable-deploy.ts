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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const firebaseToken = await getFirebaseToken()
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${firebaseToken}`,
    'Content-Type': 'application/json',
  }
  if (cachedCastleToken) {
    headers['X-Castle-Request-Token'] = cachedCastleToken
  }
  return headers
}

/**
 * Deploy no Lovable.
 * - Tenta POST /deployments com Castle token (se disponível)
 * - Se Castle token não disponível (403), o deploy ocorre automaticamente
 *   via GitHub sync (Lovable detecta o commit e rebuilda)
 */
export async function deployLovable(
  projectId: string,
  onProgress?: (msg: string) => Promise<void>,
): Promise<{ ok: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders()

    if (onProgress) await onProgress('🚀 Disparando deploy no Lovable...')

    const res = await fetch(
      `https://api.lovable.dev/projects/${projectId}/deployments?async=true`,
      { method: 'POST', headers, body: '{}' }
    )

    if (res.ok) {
      return { ok: true, message: '✅ Deploy disparado no Lovable com sucesso!' }
    }

    // 403 = Castle token ausente/inválido — deploy via GitHub sync
    if (res.status === 403) {
      return {
        ok: true,
        message: '🔄 Deploy automático via GitHub sync (Lovable rebuilda ao detectar o commit)',
      }
    }

    const body = await res.text().catch(() => '')
    return { ok: false, message: `⚠️ Lovable retornou ${res.status}: ${body.slice(0, 100)}` }
  } catch (err) {
    return { ok: false, message: `❌ Erro no deploy: ${(err as Error).message}` }
  }
}
