import { NextRequest, NextResponse } from 'next/server'
import { buscarMensagensDoContato, filtrarConversaPorFluxo } from '@/lib/integrações/sendpulseConversaFluxo'

export const maxDuration = 60

// Aceita tanto data pura (YYYY-MM-DD) quanto datetime completo (YYYY-MM-DDTHH:mm:ss) —
// se já vier com hora ("T" no meio), usa como está; senão assume a borda do dia
// (00:00:00 pro início, 23:59:59 pro fim), igual ao comportamento antigo (só data).
function limiteInicio(valor: string): string {
  return valor.includes('T') ? valor : `${valor}T00:00:00`
}
function limiteFim(valor: string): string {
  return valor.includes('T') ? valor : `${valor}T23:59:59`
}

export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get('contactId')
  const flowId = request.nextUrl.searchParams.get('flowId')
  // YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss, opcionais — com hora, corta no instante exato.
  const dataInicio = request.nextUrl.searchParams.get('dataInicio')
  const dataFim = request.nextUrl.searchParams.get('dataFim')

  if (!contactId) return NextResponse.json({ error: 'contactId é obrigatório' }, { status: 400 })
  if (!flowId) return NextResponse.json({ error: 'flowId é obrigatório' }, { status: 400 })

  try {
    const brutas = await buscarMensagensDoContato(contactId)
    let mensagens = filtrarConversaPorFluxo(brutas, flowId)
    if (dataInicio) mensagens = mensagens.filter((m) => m.criadoEm >= limiteInicio(dataInicio))
    if (dataFim) mensagens = mensagens.filter((m) => m.criadoEm <= limiteFim(dataFim))

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
