import { NextRequest, NextResponse } from 'next/server'
import { listarTags } from '@/lib/mcp/sendpulse'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 5 * 60_000

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('botId')
  if (!botId) {
    return NextResponse.json({ error: 'botId é obrigatório' }, { status: 400 })
  }

  try {
    const tags = await getOrFetch('sendpulse-tags-por-bot', botId, TTL_MS, () => listarTags(botId))
    return NextResponse.json({ tags })
  } catch (err) {
    // A SendPulse recusa (400) listar tags de números desconectados/pausados — não é uma
    // falha de rede, é uma resposta válida do tipo "esse bot não tem tags disponíveis pra
    // listar". Devolve 200 com a flag pra UI explicar isso em vez de parecer "sem tags".
    const mensagem = (err as Error).message ?? ''
    const desconectado = mensagem.includes('status 400')
    return NextResponse.json({ tags: [], desconectado, erro: desconectado ? undefined : mensagem })
  }
}
