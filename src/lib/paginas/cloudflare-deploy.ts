import { createHash } from 'crypto'
import { getGhToken } from './github-sync'

const CF_API = 'https://api.cloudflare.com/client/v4'

function getCfToken() { return process.env.CLOUDFLARE_API_TOKEN || '' }
function getCfAccountId() { return process.env.CLOUDFLARE_ACCOUNT_ID || '' }

interface RepoFile { path: string; content: Buffer }

/** Busca todos os arquivos deployáveis de um repo GitHub */
async function fetchRepoFiles(ghToken: string, owner: string, repo: string): Promise<RepoFile[]> {
  // Tenta main, depois master
  let branch = 'main'
  let treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github.v3+json' },
  })
  if (!treeRes.ok) {
    branch = 'master'
    treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
      headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github.v3+json' },
    })
  }
  if (!treeRes.ok) throw new Error(`Erro ao buscar tree do repo: ${treeRes.status}`)

  const tree = await treeRes.json()
  const skipPaths = ['node_modules/', '.git/', '.github/', 'wrangler.jsonc', 'wrangler.toml', 'package.json', 'package-lock.json', '.wranglerignore', '.gitignore', 'README.md']

  const files: RepoFile[] = []
  for (const item of tree.tree) {
    if (item.type !== 'blob') continue
    if (skipPaths.some(s => item.path === s || item.path.startsWith(s))) continue

    const blobRes = await fetch(item.url, {
      headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (!blobRes.ok) continue
    const blob = await blobRes.json()
    const content = Buffer.from(blob.content, 'base64')
    files.push({ path: '/' + item.path, content })
  }
  return files
}

/**
 * Deploy de um worker estático (html_whatsapp) no Cloudflare Workers.
 * Busca arquivos do GitHub e faz upload via Assets API.
 */
export async function deployCloudflare(
  owner: string,
  repo: string,
  onProgress?: (msg: string) => Promise<void>,
): Promise<{ ok: boolean; message: string; url?: string }> {
  const cfToken = getCfToken()
  const accountId = getCfAccountId()
  const workerName = repo // worker name = repo name

  if (!cfToken || !accountId) {
    return { ok: false, message: '⚠️ CLOUDFLARE_API_TOKEN ou CLOUDFLARE_ACCOUNT_ID não configurado' }
  }

  try {
    if (onProgress) await onProgress('☁️ Buscando arquivos do GitHub...')

    const ghToken = await getGhToken()
    const files = await fetchRepoFiles(ghToken, owner, repo)
    if (files.length === 0) return { ok: false, message: '❌ Nenhum arquivo encontrado no repo' }

    if (onProgress) await onProgress(`☁️ Enviando ${files.length} arquivos pro Cloudflare...`)

    // Criar manifest (path → {hash, size})
    const manifest: Record<string, { hash: string; size: number }> = {}
    const hashToFile = new Map<string, RepoFile>()
    for (const f of files) {
      const hash = createHash('sha256').update(f.content).digest('hex')
      manifest[f.path] = { hash, size: f.content.length }
      hashToFile.set(hash, f)
    }

    // 1. Criar upload session
    const sessionRes = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${workerName}/assets-upload-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest }),
    })
    const session = await sessionRes.json()
    if (!session.success) {
      return { ok: false, message: `❌ Upload session falhou: ${JSON.stringify(session.errors)}` }
    }

    const { jwt, buckets } = session.result

    // 2. Upload dos arquivos em buckets
    for (const bucket of (buckets || [])) {
      if (!bucket.length) continue

      // Criar FormData com os arquivos desse bucket
      const formData = new FormData()
      for (const hash of bucket) {
        const file = hashToFile.get(hash)
        if (file) {
          formData.append(hash, new Blob([new Uint8Array(file.content)]), file.path)
        }
      }

      const uploadRes = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${workerName}/assets-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.text()
        return { ok: false, message: `❌ Upload falhou: ${err.slice(0, 200)}` }
      }
    }

    // 3. Deploy do worker com os assets
    const deployForm = new FormData()
    deployForm.append('metadata', new Blob([JSON.stringify({
      main_module: '__asset-worker.js',
      assets: { jwt },
      compatibility_date: '2026-05-15',
      compatibility_flags: ['nodejs_compat'],
      observability: { enabled: true },
    })], { type: 'application/json' }), 'metadata')
    deployForm.append('__asset-worker.js', new Blob([
      'export default { async fetch(request, env) { return env.ASSETS.fetch(request); } }',
    ], { type: 'application/javascript+module' }), '__asset-worker.js')

    const deployRes = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${workerName}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cfToken}` },
      body: deployForm,
    })
    const deployResult = await deployRes.json()
    if (!deployResult.success) {
      return { ok: false, message: `❌ Deploy falhou: ${JSON.stringify(deployResult.errors).slice(0, 200)}` }
    }

    const url = `https://${workerName}.rayan-pablo.workers.dev`
    return { ok: true, message: '✅ Deploy no Cloudflare concluído!', url }
  } catch (err) {
    return { ok: false, message: `❌ Erro no deploy Cloudflare: ${(err as Error).message}` }
  }
}
