import { NextRequest, NextResponse } from 'next/server'
import { buscarMensagensDoContato, filtrarConversaPorFluxo } from '@/lib/integrações/sendpulseConversaFluxo'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get('contactId')
  const flowId = request.nextUrl.searchParams.get('flowId')
  const dataInicio = request.nextUrl.searchParams.get('dataInicio') // YYYY-MM-DD, opcional
  const dataFim = request.nextUrl.searchParams.get('dataFim') // YYYY-MM-DD, opcional

  if (!contactId) return NextResponse.json({ error: 'contactId é obrigatório' }, { status: 400 })
  if (!flowId) return NextResponse.json({ error: 'flowId é obrigatório' }, { status: 400 })

  try {
    const brutas = await buscarMensagensDoContato(contactId)
    let mensagens = filtrarConversaPorFluxo(brutas, flowId)
    if (dataInicio) mensagens = mensagens.filter((m) => m.criadoEm >= dataInicio)
    if (dataFim) mensagens = mensagens.filter((m) => m.criadoEm <= `${dataFim}T23:59:59`)

    return NextResponse.json({
      contactId,
      flowId,
      totalMensagens: mensagens.length,
      botoesClicados: mensagens.filter((m) => m.tipo === 'botao_clicado' || m.tipo === 'lista_selecionada').length,
      linksEnviados: mensagens.filter((m) => m.tipo === 'link_enviado').length,
      avisoLinks: 'Clique em botão de link (cta_url) não gera mensagem de resposta no WhatsApp — só sabemos que o link foi enviado, não se foi clicado.',
      mensagens,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
