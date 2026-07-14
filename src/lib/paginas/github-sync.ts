export async function getGhToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    const { execSync } = await import('child_process')
    const token = execSync('gh auth token', { encoding: 'utf8' }).trim()
    if (token) return token
  } catch { /* gh CLI não disponível */ }
  throw new Error('GITHUB_TOKEN não configurado. Adicione ao .env ou execute `gh auth login`.')
}

export async function fetchFileFromGitHub(token: string, owner: string, repo: string, path: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
  if (!res.ok) return null
  const json = await res.json()
  return Buffer.from(json.content, 'base64').toString('utf8')
}

export async function fetchFileWithSha(token: string, owner: string, repo: string, path: string): Promise<{ content: string | null; sha: string | null; error?: string }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
  if (!res.ok) {
    const text = await res.text()
    return { content: null, sha: null, error: `GitHub ${res.status}: ${text}` }
  }
  const json = await res.json()
  return {
    content: Buffer.from(json.content, 'base64').toString('utf8'),
    sha: json.sha,
  }
}

export async function commitFile(token: string, owner: string, repo: string, path: string, content: string, sha: string, message: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub commit failed: ${res.status} ${text}`)
  }
}

export function extractDestinations(content: string): Array<{ phone: string; flowId: string; weight: number }> {
  const match = content.match(/const DESTINATIONS\s*=\s*\[([\s\S]*?)\];/)
  if (!match) return []
  try {
    const arrayStr = '[' + match[1]
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"')
      .replace(/,\s*\]/g, ']')
      + ']'
    return JSON.parse(arrayStr)
  } catch {
    return []
  }
}

export function extractText(content: string): string {
  const match = content.match(/const TEXT\s*=\s*["'`](.*?)["'`]/)
  return match ? match[1] : ''
}

export function replaceDestinations(content: string, destinations: Array<{ phone: string; flowId: string; weight: number }>): string {
  const newDest = destinations
    .map(d => `{ phone: "${d.phone}", flowId: "${d.flowId}", weight: ${d.weight} }`)
    .join(', ')
  return content.replace(
    /const DESTINATIONS\s*=\s*\[[\s\S]*?\];/,
    `const DESTINATIONS = [${newDest}];`
  )
}

export function replaceText(content: string, text: string): string {
  return content.replace(
    /const TEXT\s*=\s*["'`].*?["'`]/,
    `const TEXT = "${text}"`
  )
}
