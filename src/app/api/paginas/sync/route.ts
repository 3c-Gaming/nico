import { NextRequest, NextResponse } from 'next/server'

// Lê o tracking-whatsapp.tsx de um repo GitHub e extrai DESTINATIONS + TEXT
export async function POST(request: NextRequest) {
  try {
    const { owner, repo } = await request.json()
    if (!owner || !repo) {
      return NextResponse.json({ error: 'owner e repo são obrigatórios' }, { status: 400 })
    }

    // Pegar token do gh CLI
    const token = await getGhToken()

    // Buscar o arquivo tracking-whatsapp.tsx no repo
    const fileContent = await fetchFileFromGitHub(token, owner, repo, 'src/components/tracking-whatsapp.tsx')
    if (!fileContent) {
      return NextResponse.json({ error: 'tracking-whatsapp.tsx não encontrado no repositório' }, { status: 404 })
    }

    // Extrair DESTINATIONS e TEXT do conteúdo
    const destinations = extractDestinations(fileContent)
    const text = extractText(fileContent)

    return NextResponse.json({ destinations, text, raw: fileContent })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro ao sincronizar' }, { status: 500 })
  }
}

// PUT - Atualiza o tracking-whatsapp.tsx no GitHub com novos DESTINATIONS e TEXT
export async function PUT(request: NextRequest) {
  try {
    const { owner, repo, destinations, text } = await request.json()
    if (!owner || !repo || !destinations) {
      return NextResponse.json({ error: 'owner, repo e destinations são obrigatórios' }, { status: 400 })
    }

    const token = await getGhToken()
    const filePath = 'src/components/tracking-whatsapp.tsx'

    // 1. Buscar conteúdo atual + sha
    const { content: currentContent, sha, error: fetchError } = await fetchFileWithSha(token, owner, repo, filePath)
    if (!currentContent || !sha) {
      return NextResponse.json({ error: fetchError || 'Arquivo não encontrado' }, { status: 404 })
    }

    // 2. Substituir DESTINATIONS e TEXT no conteúdo
    let newContent = replaceDestinations(currentContent, destinations)
    if (text !== undefined) {
      newContent = replaceText(newContent, text)
    }

    // 3. Commit via GitHub API
    await commitFile(token, owner, repo, filePath, newContent, sha, `chore: atualizar DESTINATIONS via Nico`)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro ao atualizar' }, { status: 500 })
  }
}

// --- Helpers ---

async function getGhToken(): Promise<string> {
  // 1. Tentar env var (funciona no Vercel)
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  // 2. Fallback: gh CLI (funciona local)
  try {
    const { execSync } = await import('child_process')
    const token = execSync('gh auth token', { encoding: 'utf8' }).trim()
    if (token) return token
  } catch { /* gh CLI não disponível */ }
  throw new Error('GITHUB_TOKEN não configurado. Adicione ao .env ou execute `gh auth login`.')
}

async function fetchFileFromGitHub(token: string, owner: string, repo: string, path: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
  if (!res.ok) return null
  const json = await res.json()
  return Buffer.from(json.content, 'base64').toString('utf8')
}

async function fetchFileWithSha(token: string, owner: string, repo: string, path: string): Promise<{ content: string | null; sha: string | null; error?: string }> {
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

async function commitFile(token: string, owner: string, repo: string, path: string, content: string, sha: string, message: string) {
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

function extractDestinations(content: string): Array<{ phone: string; flowId: string; weight: number }> {
  const match = content.match(/const DESTINATIONS\s*=\s*\[([\s\S]*?)\];/)
  if (!match) return []
  try {
    // Converter o array JS para JSON válido
    const arrayStr = '[' + match[1]
      .replace(/(\w+):/g, '"$1":')  // chaves sem aspas -> com aspas
      .replace(/'/g, '"')           // aspas simples -> duplas
      .replace(/,\s*\]/g, ']')      // trailing comma
      + ']'
    return JSON.parse(arrayStr)
  } catch {
    return []
  }
}

function extractText(content: string): string {
  const match = content.match(/const TEXT\s*=\s*["'`](.*?)["'`]/)
  return match ? match[1] : ''
}

function replaceDestinations(content: string, destinations: Array<{ phone: string; flowId: string; weight: number }>): string {
  const newDest = destinations
    .map(d => `{ phone: "${d.phone}", flowId: "${d.flowId}", weight: ${d.weight} }`)
    .join(', ')
  return content.replace(
    /const DESTINATIONS\s*=\s*\[[\s\S]*?\];/,
    `const DESTINATIONS = [${newDest}];`
  )
}

function replaceText(content: string, text: string): string {
  return content.replace(
    /const TEXT\s*=\s*["'`].*?["'`]/,
    `const TEXT = "${text}"`
  )
}
