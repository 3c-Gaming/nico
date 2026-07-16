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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface DeploymentInfo {
  id: string
  status: string
  created_at?: string
  updated_at?: string
  url?: string
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

async function getLatestDeployment(projectId: string, headers: Record<string, string>): Promise<DeploymentInfo | null> {
  try {
    const res = await fetch(
      `https://api.lovable.dev/projects/${projectId}/deployments`,
      { headers }
    )
    if (!res.ok) return null
    const data = await res.json()
    const deployments = Array.isArray(data) ? data : data.deployments || data.data || []
    if (deployments.length === 0) return null
    return deployments[0] as DeploymentInfo
  } catch {
    return null
  }
}

/**
 * Deploy no Lovable com verificação real de status.
 * 1. Busca o deployment mais recente (snapshot antes do commit)
 * 2. Aguarda um novo deployment aparecer (trigger via GitHub sync)
 * 3. Pollla o status até completar ou falhar
 *
 * onProgress: callback para atualizar mensagem no Telegram
 */
export async function deployLovable(
  projectId: string,
  onProgress?: (msg: string) => Promise<void>,
): Promise<{ ok: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders()

    // Snapshot: pegar o deployment mais recente antes do commit
    const before = await getLatestDeployment(projectId, headers)
    const beforeId = before?.id || null

    // Aguardar GitHub sync disparar o build (5-15s normalmente)
    if (onProgress) await onProgress('⏳ Aguardando Lovable detectar o commit...')

    let newDeploy: DeploymentInfo | null = null
    const maxWaitNew = 60_000 // 60s para detectar novo deploy
    const start = Date.now()

    while (Date.now() - start < maxWaitNew) {
      await sleep(5000)
      const latest = await getLatestDeployment(projectId, headers)
      if (latest && latest.id !== beforeId) {
        newDeploy = latest
        break
      }
    }

    if (!newDeploy) {
      return { ok: false, message: '⚠️ Lovable não detectou o commit ainda. O deploy pode ocorrer em breve.' }
    }

    // Pollar status do deploy até completar
    if (onProgress) await onProgress(`🔨 Deploy em andamento... (${newDeploy.status})`)

    const maxWaitBuild = 120_000 // 2min para buildar
    const buildStart = Date.now()

    while (Date.now() - buildStart < maxWaitBuild) {
      const current = await getLatestDeployment(projectId, headers)
      if (!current || current.id !== newDeploy.id) break

      const status = current.status?.toLowerCase() || ''

      if (status === 'success' || status === 'completed' || status === 'live' || status === 'published') {
        const url = current.url ? `\n🔗 ${current.url}` : ''
        return { ok: true, message: `✅ Deploy concluído com sucesso!${url}` }
      }

      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        return { ok: false, message: `❌ Deploy falhou (${current.status})` }
      }

      // Ainda em progresso
      if (onProgress) await onProgress(`🔨 Deploy: ${current.status}...`)
      await sleep(5000)
    }

    // Timeout — mas pode ter completado
    const final = await getLatestDeployment(projectId, headers)
    if (final && final.id === newDeploy.id) {
      const status = final.status?.toLowerCase() || ''
      if (status === 'success' || status === 'completed' || status === 'live' || status === 'published') {
        return { ok: true, message: '✅ Deploy concluído com sucesso!' }
      }
      return { ok: false, message: `⚠️ Deploy ainda em andamento (${final.status}). Verifique no Lovable.` }
    }

    return { ok: false, message: '⚠️ Timeout aguardando deploy. Verifique no Lovable.' }
  } catch (err) {
    return { ok: false, message: `❌ Erro no deploy: ${(err as Error).message}` }
  }
}
