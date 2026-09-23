import { NextRequest, NextResponse } from 'next/server'
import {
  buscarMensagensDoContatoNaConta,
  buscarUltimosContatosPorTag,
  filtrarConversaPorFluxo,
  acharTagDeCliqueLink,
  type MensagemFluxo,
} from '@/lib/integrações/sendpulseConversaFluxo'
import { comContaECanalDoBot } from '@/lib/integrações/contasSendpulse'

// Processar em lotes (ver BATCH_SIZE_MENSAGENS) é mais lento que tudo em paralelo — folga maior
// que o padrão da Vercel pra não matar a função no meio de uma busca ainda válida.
export const maxDuration = 120

const QUANTIDADE_PADRAO = 50
// Pede mais candidatos do que precisa — um contato pode ter a tag mas não ter mensagem
// correlacionável a esse flowId específico (ex: tag setada manualmente, ou por outro
// caminho que não passou por esse fluxo). Busca com folga e filtra os que sobram.
const MULTIPLICADOR_CANDIDATOS = 3
// Cada candidato dispara pelo menos 1 chamada à SendPulse (histórico de mensagens) — buscar todos
// de uma vez (até quantidade × MULTIPLICADOR_CANDIDATOS = 150 por padrão) estoura o limite de 30
// req/min da conta. Processa em lotes pequenos (mesmo princípio de BATCH_SIZE em
// monitoramento/route.ts) — mais lento, mas não derruba a conta inteira num rate limit.
const BATCH_SIZE_MENSAGENS = 6

interface LeadComConversa {
  contactId: string
  nome: string
  telefone: string
  ultimaAtividade: string
  tags: string[]
  variaveis: Record<string, unknown>
  mensagens: MensagemFluxo[]
  tagCliqueLink: string | null
}

/** Timestamp da última mensagem de ENTRADA (resposta do lead) dentro da jornada — null se o
 * lead recebeu a mensagem mas ainda não respondeu nada. Usado pra ordenar a lista por quem
 * interagiu mais recentemente, não só por quem entrou na tag mais recentemente (em disparos em
 * lote pra muita gente de uma vez, a ordem de entrada na tag não diz nada sobre quem já respondeu). */
function ultimaRespostaEm(mensagens: MensagemFluxo[]): string | null {
  let ultima: string | null = null
  for (const m of mensagens) {
    if (m.direcao !== 'entrada') continue
    if (!ultima || m.criadoEm > ultima) ultima = m.criadoEm
  }
  return ultima
}

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('botId')
  const tag = request.nextUrl.searchParams.get('tag')
  const flowId = request.nextUrl.searchParams.get('flowId')
  const quantidade = Number(request.nextUrl.searchParams.get('quantidade') ?? QUANTIDADE_PADRAO)

  if (!botId) return NextResponse.json({ error: 'botId é obrigatório' }, { status: 400 })
  if (!tag) return NextResponse.json({ error: 'tag é obrigatório' }, { status: 400 })
  if (!flowId) return NextResponse.json({ error: 'flowId é obrigatório' }, { status: 400 })

  // Tag usada pra BUSCAR os candidatos (getByTag) — por padrão é a mesma tag de entrada, mas o
  // painel deixa filtrar por qualquer outra tag do fluxo (ex: só quem chegou em CTA_BILHETE),
  // enquanto `tag` continua sendo a tag de entrada, usada pra resolver o sufixo do clique de link.
  const tagFiltro = request.nextUrl.searchParams.get('tagFiltro') || tag

  try {
    // getByTag falha esporadicamente com 400 mesmo na conta/canal CERTA (confirmado ao vivo:
    // o mesmo combo que funciona minutos depois falha agora — cara de rate limit da SendPulse
    // se manifestando como 400 em vez do 429 de sempre, não um "tag não existe" de verdade).
    // comContaECanalDoBot já cascateia até 6 combos de conta×canal, mas se TODOS falharem nesse
    // instante (visto ao vivo pedindo 6 tags em sequência rápida), uma 2ª tentativa passados
    // ~1,5s já resolve — mesmo princípio do retry em contarTagHoje (lib/sendpulse/relatorio.ts).
    let resolvidos: PromiseSettledResult<LeadComConversa>[] | undefined
    let ultimoErro: unknown
    for (let tentativa = 0; tentativa < 2 && !resolvidos; tentativa++) {
      try {
        resolvidos = await comContaECanalDoBot(botId, async (apiKey, canal) => {
          const candidatos = await buscarUltimosContatosPorTag(botId, tagFiltro, apiKey, quantidade * MULTIPLICADOR_CANDIDATOS, canal)

          const resultados: PromiseSettledResult<LeadComConversa>[] = []
          for (let i = 0; i < candidatos.length; i += BATCH_SIZE_MENSAGENS) {
            const lote = candidatos.slice(i, i + BATCH_SIZE_MENSAGENS)
            const loteResolvido = await Promise.allSettled(
              lote.map(async (candidato): Promise<LeadComConversa> => {
                const brutas = await buscarMensagensDoContatoNaConta(apiKey, candidato.contactId, canal)
                const mensagens = filtrarConversaPorFluxo(brutas, flowId)
                return { ...candidato, mensagens, tagCliqueLink: acharTagDeCliqueLink(tag, candidato.tags) }
              }),
            )
            resultados.push(...loteResolvido)
          }
          return resultados
        })
      } catch (err) {
        ultimoErro = err
        if (tentativa === 0) await new Promise((r) => setTimeout(r, 1500))
      }
    }
    if (!resolvidos) throw ultimoErro instanceof Error ? ultimoErro : new Error('Falha ao buscar conversas')

    // Descarta quem não tem mensagem correlacionável a esse fluxo (ou cuja busca falhou), e
    // ordena por quem respondeu mais recentemente — não pela recência de entrada na tag (que,
    // num disparo em lote pra muita gente de uma vez, não diz nada sobre quem já interagiu).
    // Quem ainda não respondeu nada fica no fim, na ordem original (recência do getByTag).
    const leads = resolvidos
      .filter((r): r is PromiseFulfilledResult<LeadComConversa> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((lead) => lead.mensagens.length > 0)
      .sort((a, b) => {
        const ra = ultimaRespostaEm(a.mensagens)
        const rb = ultimaRespostaEm(b.mensagens)
        if (ra && rb) return rb.localeCompare(ra)
        if (ra && !rb) return -1
        if (!ra && rb) return 1
        return 0
      })
      .slice(0, quantidade)

    return NextResponse.json({
      botId,
      flowId,
      tag,
      tagFiltro,
      avisoLinks: 'Clique em botão de link (cta_url) não gera mensagem de resposta no WhatsApp — mas se o fluxo tem uma tag "CTA_*" setada só quando o link é aberto, ela aparece em tagCliqueLink de cada lead como confirmação do clique.',
      leads,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
