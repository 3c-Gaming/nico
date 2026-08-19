import { NextRequest, NextResponse } from 'next/server'
import { buscarContatosPorTagIntervaloSendpulse } from '@/lib/integrações/sendpulse'
import { buscarMensagensDoContatoNaConta, filtrarConversaPorFluxo, acharTagDeCliqueLink } from '@/lib/integrações/sendpulseConversaFluxo'
import { comContaECanalDoBot } from '@/lib/integrações/contasSendpulse'

// Varre a conversa de TODO lead do período (não só uma amostra) pra contar cliques únicos num
// botão específico — pode levar mais tempo que as rotas de contagem simples em fluxos com muito
// volume no dia (ex: 250 leads = 250 buscas de histórico de mensagens).
export const maxDuration = 200

interface Body {
  botId: string
  tag: string
  flowId: string
  botaoTitulo: string
  tipo: 'botao' | 'link'
  dataInicio: string
  dataFim: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Body
    const { botId, tag, flowId, botaoTitulo, tipo, dataInicio, dataFim } = body
    if (!botId || !tag || !flowId || !botaoTitulo || !tipo || !dataInicio || !dataFim) {
      return NextResponse.json({ error: 'botId, tag, flowId, botaoTitulo, tipo, dataInicio e dataFim são obrigatórios' }, { status: 400 })
    }

    const contagem = await comContaECanalDoBot(botId, async (apiKey, canal) => {
      const contatos = await buscarContatosPorTagIntervaloSendpulse(botId, tag, apiKey, dataInicio, dataFim, undefined, canal)

      const resolvidos = await Promise.allSettled(
        contatos.map(async (contato) => {
          const brutas = await buscarMensagensDoContatoNaConta(apiKey, contato.id, canal)
          const mensagens = filtrarConversaPorFluxo(brutas, flowId)

          if (tipo === 'link') {
            const cliqueConfirmado = !!acharTagDeCliqueLink(tag, contato.tags)
            return cliqueConfirmado && mensagens.some((m) => m.tipo === 'link_enviado' && m.linkTexto === botaoTitulo)
          }

          return mensagens.some((m) => (m.tipo === 'botao_clicado' || m.tipo === 'lista_selecionada') && m.botaoTitulo === botaoTitulo)
        }),
      )

      return resolvidos.filter((r) => r.status === 'fulfilled' && r.value === true).length
    })

    return NextResponse.json({ contagem })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
