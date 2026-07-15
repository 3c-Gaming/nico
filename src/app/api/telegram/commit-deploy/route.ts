import { NextResponse } from 'next/server'
import {
  getGhToken, fetchFileWithSha, commitFile,
  replaceDestinations, extractRedirectUrl, replaceRedirectUrl,
  extractLeadFlowConfig, replaceLeadFlowConfig,
  extractRedirectConfig, replaceRedirectConfig,
} from '@/lib/paginas/github-sync'

const FIREBASE_API_KEY = process.env.LOVABLE_FIREBASE_API_KEY
const REFRESH_TOKEN = process.env.LOVABLE_REFRESH_TOKEN
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

let cachedFirebaseToken: { accessToken: string; expiresAt: number } | null = null

async function getFirebaseToken(): Promise<string> {
  if (cachedFirebaseToken && Date.now() < cachedFirebaseToken.expiresAt - 60_000) {
    return cachedFirebaseToken.accessToken
  }
  if (!FIREBASE_API_KEY || !REFRESH_TOKEN) throw new Error('Credenciais Lovable não configuradas')
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`,
  })
  if (!res.ok) throw new Error(`Firebase token error: ${res.status}`)
  const data = await res.json()
  cachedFirebaseToken = {
    accessToken: data.access_token || data.id_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  }
  return cachedFirebaseToken.accessToken
}

async function sendTelegram(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  }).catch(() => {})
}

function updateUrlParam(urlStr: string, paramName: string, newValue: string): string {
  try {
    const qIdx = urlStr.indexOf('?')
    if (qIdx === -1) return urlStr
    const base = urlStr.slice(0, qIdx)
    const params = new URLSearchParams(urlStr.slice(qIdx + 1))
    params.set(paramName, newValue)
    return base + '?' + params.toString()
  } catch { return urlStr }
}

export async function POST(req: Request) {
  let chatId: number | null = null
  let nome = ''

  try {
    const body = await req.json()
    const { state, castleToken } = body
    if (!state || !castleToken) {
      return NextResponse.json({ error: 'state e castleToken obrigatórios' }, { status: 400 })
    }

    chatId = state.chatId || null
    nome = state.nome || ''

    const { type, github_owner, github_repo, tracking_file, lovable_project_id } = state

    if (!github_owner || !github_repo || !tracking_file) {
      if (chatId) await sendTelegram(chatId, `❌ Dados da página incompletos`)
      return NextResponse.json({ error: 'Dados da página incompletos' }, { status: 400 })
    }

    // 1. Commit no GitHub
    const ghToken = await getGhToken()
    const { content, sha } = await fetchFileWithSha(ghToken, github_owner, github_repo, tracking_file)
    if (!content || !sha) throw new Error('Arquivo não encontrado no GitHub')

    let newContent = content
    let commitMsg = ''

    if (type === 'config') {
      const { campo, valorAtual } = state
      if (campo.startsWith('url:')) {
        const paramName = campo.slice(4)
        if (tracking_file.includes('leadFlow')) {
          const config = extractLeadFlowConfig(content)
          if (!config) throw new Error('LEAD_FLOW_CONFIG não encontrado')
          config.redirectUrl = updateUrlParam(config.redirectUrl, paramName, valorAtual)
          newContent = replaceLeadFlowConfig(content, config)
        } else {
          const oldUrl = extractRedirectUrl(content)
          const newUrl = updateUrlParam(oldUrl, paramName, valorAtual)
          newContent = replaceRedirectUrl(content, newUrl)
        }
      } else if (tracking_file.includes('leadFlow')) {
        const config = extractLeadFlowConfig(content)
        if (!config) throw new Error('LEAD_FLOW_CONFIG não encontrado')
        ;(config as any)[campo] = valorAtual
        newContent = replaceLeadFlowConfig(content, config)
      } else if (tracking_file.includes('redirect.ts')) {
        const config = extractRedirectConfig(content)
        if (!config) throw new Error('REDIRECT_CONFIG não encontrado')
        ;(config as any)[campo] = valorAtual
        newContent = replaceRedirectConfig(content, config)
      } else {
        newContent = replaceRedirectUrl(content, valorAtual)
      }
      const displayCampo = campo.startsWith('url:') ? campo.slice(4) : campo
      commitMsg = `chore: atualizar ${displayCampo} via Telegram`
    } else if (type === 'whatsapp') {
      const { destIndex, novoPhone, novoFlowId, destinations } = state
      const newDests = [...destinations]
      newDests[destIndex] = { ...newDests[destIndex], phone: novoPhone, flowId: novoFlowId }
      newContent = replaceDestinations(content, newDests)
      commitMsg = `chore: trocar dest ${destIndex + 1} via Telegram`
    } else {
      if (chatId) await sendTelegram(chatId, `❌ Tipo de edição desconhecido`)
      return NextResponse.json({ error: 'Tipo de edição desconhecido' }, { status: 400 })
    }

    await commitFile(ghToken, github_owner, github_repo, tracking_file, newContent, sha, commitMsg)

    // 2. Deploy no Lovable
    let deployResult = null
    if (lovable_project_id) {
      const firebaseToken = await getFirebaseToken()
      const deployRes = await fetch(
        `https://api.lovable.dev/projects/${lovable_project_id}/deployments?async=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firebaseToken}`,
            'Content-Type': 'application/json',
            'X-Castle-Request-Token': castleToken,
          },
          body: '{}',
        }
      )
      const deployText = await deployRes.text()
      if (deployRes.ok) {
        deployResult = JSON.parse(deployText)
      } else {
        deployResult = { error: deployText }
      }
    }

    // 3. Atualizar Supabase (para whatsapp)
    if (type === 'whatsapp' && state.paginaId) {
      try {
        const { getSupabase } = await import('@/lib/db/supabase')
        const sb = getSupabase()
        if (sb) {
          const { destIndex, novoPhone, novoFlowId, destinations } = state
          const newDests = [...destinations]
          newDests[destIndex] = { ...newDests[destIndex], phone: novoPhone, flowId: novoFlowId }
          await (sb.from('paginas') as any).update({
            destinations: newDests,
            updated_at: new Date().toISOString(),
          }).eq('id', state.paginaId)
        }
      } catch { /* não crítico */ }
    }

    // 4. Enviar mensagem de sucesso no Telegram
    if (chatId) {
      let msg = `✅ *Commit + Deploy concluído!*\n\n📄 ${nome}\n📝 ${commitMsg}`
      if (deployResult?.url) {
        msg += `\n🚀 Deploy: ${deployResult.url}`
      } else if (deployResult?.deployment_id) {
        msg += `\n🚀 Deploy iniciado`
      } else if (deployResult?.error) {
        msg += `\n⚠️ Deploy: erro`
      } else if (!lovable_project_id) {
        msg += `\n📌 Sem deploy (sem projeto Lovable)`
      }
      await sendTelegram(chatId, msg)
    }

    return NextResponse.json({ ok: true, nome, commitMsg, deploy: deployResult })
  } catch (err) {
    const errorMsg = (err as Error).message
    if (chatId) {
      await sendTelegram(chatId, `❌ *Erro ao commitar/deployar*\n\n📄 ${nome}\n💥 ${errorMsg}`)
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
