import { NextRequest, NextResponse } from 'next/server'
import {
  buscarMensagensDoContatoNaConta,
  buscarUltimosContatosPorTag,
  filtrarConversaPorFluxo,
  type MensagemFluxo,
} from '@/lib/integrações/sendpulseConversaFluxo'
import { apiKeyParaBot } from '@/lib/integrações/contasSendpulse'

export const maxDuration = 60

const QUANTIDADE_PADRAO = 5
// Pede mais candidatos do que precisa — um contato pode ter a tag mas não ter mensagem
// correlacionável a esse flowId específico (ex: tag setada manualmente, ou por outro
// caminho que não passou por esse fluxo). Busca com folga e filtra os que sobram.
const MULTIPLICADOR_CANDIDATOS = 3

interface LeadComConversa {
  contactId: string
  nome: string
  telefone: string
  ultimaAtividade: string
  tags: string[]
  variaveis: Record<string, unknown>
  mensagens: MensagemFluxo[]
}

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('botId')
  const tag = request.nextUrl.searchParams.get('tag')
  const flowId = request.nextUrl.searchParams.get('flowId')
  const quantidade = Number(request.nextUrl.searchParams.get('quantidade') ?? QUANTIDADE_PADRAO)

  if (!botId) return NextResponse.json({ error: 'botId é obrigatório' }, { status: 400 })
  if (!tag) return NextResponse.json({ error: 'tag é obrigatório' }, { status: 400 })
  if (!flowId) return NextResponse.json({ error: 'flowId é obrigatório' }, { status: 400 })

  try {
    const apiKey = apiKeyParaBot(botId)
    if (!apiKey) return NextResponse.json({ error: `Nenhuma conta SendPulse reconhece o bot ${botId}` }, { status: 400 })

    const candidatos = await buscarUltimosContatosPorTag(botId, tag, apiKey, quantidade * MULTIPLICADOR_CANDIDATOS)

    const resolvidos = await Promise.allSettled(
      candidatos.map(async (candidato): Promise<LeadComConversa> => {
        const brutas = await buscarMensagensDoContatoNaConta(apiKey, candidato.contactId)
        const mensagens = filtrarConversaPorFluxo(brutas, flowId)
        return { ...candidato, mensagens }
      }),
    )

    // Mantém a ordem de recência do getByTag — só descarta quem não tem mensagem
    // correlacionável a esse fluxo (ou cuja busca falhou).
    const leads = resolvidos
      .filter((r): r is PromiseFulfilledResult<LeadComConversa> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((lead) => lead.mensagens.length > 0)
      .slice(0, quantidade)

    return NextResponse.json({
      botId,
      flowId,
      tag,
      avisoLinks: 'Clique em botão de link (cta_url) não gera mensagem de resposta no WhatsApp — só sabemos que o link foi enviado, não se foi clicado.',
      leads,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
