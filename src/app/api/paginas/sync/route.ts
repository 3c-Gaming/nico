import { NextRequest, NextResponse } from 'next/server'
import {
  getGhToken, fetchFileFromGitHub, fetchFileWithSha, commitFile,
  extractDestinations, extractText, replaceDestinations, replaceText,
} from '@/lib/paginas/github-sync'

// Lê o tracking-whatsapp.tsx de um repo GitHub e extrai DESTINATIONS + TEXT
export async function POST(request: NextRequest) {
  try {
    const { owner, repo } = await request.json()
    if (!owner || !repo) {
      return NextResponse.json({ error: 'owner e repo são obrigatórios' }, { status: 400 })
    }

    const token = await getGhToken()
    const fileContent = await fetchFileFromGitHub(token, owner, repo, 'src/components/tracking-whatsapp.tsx')
    if (!fileContent) {
      return NextResponse.json({ error: 'tracking-whatsapp.tsx não encontrado no repositório' }, { status: 404 })
    }

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
    const { owner, repo, destinations, text, lovable_project_id } = await request.json()
    if (!owner || !repo || !destinations) {
      return NextResponse.json({ error: 'owner, repo e destinations são obrigatórios' }, { status: 400 })
    }

    const token = await getGhToken()
    const filePath = 'src/components/tracking-whatsapp.tsx'

    const { content: currentContent, sha, error: fetchError } = await fetchFileWithSha(token, owner, repo, filePath)
    if (!currentContent || !sha) {
      return NextResponse.json({ error: fetchError || 'Arquivo não encontrado' }, { status: 404 })
    }

    let newContent = replaceDestinations(currentContent, destinations)
    if (text !== undefined) {
      newContent = replaceText(newContent, text)
    }

    await commitFile(token, owner, repo, filePath, newContent, sha, `chore: atualizar DESTINATIONS via Nico`)

    // Deploy no Lovable (server-side)
    let deployResult = null
    if (lovable_project_id) {
      const { deployLovable } = await import('@/lib/paginas/lovable-deploy')
      deployResult = await deployLovable(lovable_project_id)
    }

    return NextResponse.json({ success: true, deploy: deployResult })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro ao atualizar' }, { status: 500 })
  }
}
