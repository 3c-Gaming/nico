import { NextResponse } from 'next/server'
import { listarBlacksenderFlowRuns, listarBlacksenderLeadsPorIds } from '@/lib/db/supabase'

/** As tags acumuladas da jornada do lead vêm dentro do JSON cru da Black Sender (mesma convenção
 * de nome que o SendPulse — LEAD_X, FC_X, CTA_X... — dá pra crer que o fluxo foi portado de lá),
 * em `variables.tags`, crescendo conforme o lead avança nos nós do fluxo. Não documentado/tipado
 * pela Black Sender (é o payload bruto do node builder deles), então extrai defensivamente. */
function extrairTagsDaJornada(bruto: unknown): string[] {
  if (!bruto || typeof bruto !== 'object') return []
  const variables = (bruto as { variables?: unknown }).variables
  if (!variables || typeof variables !== 'object') return []
  const tags = (variables as { tags?: unknown }).tags
  return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : []
}

export async function GET(_req: Request, { params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params
  const execucoes = await listarBlacksenderFlowRuns(flowId)

  const porStatus: Record<string, number> = {}
  for (const e of execucoes) {
    const status = e.status ?? 'desconhecido'
    porStatus[status] = (porStatus[status] ?? 0) + 1
  }

  // Funil de conversão da jornada (mesma visão do FunilConversaoChart do SendPulse, mas com tags
  // que vêm prontas da Black Sender em vez de configuradas manualmente): usa só a execução mais
  // recente de cada contato (listarBlacksenderFlowRuns já ordena por criado_em_origem desc — o
  // primeiro que aparece por contactId é o mais atual), soma quantos contatos únicos já
  // acumularam cada tag, e ordena por contagem desc (a etapa de entrada sempre tem mais leads que
  // as seguintes) com a posição média dentro da jornada como desempate. Aproximação: se o fluxo
  // tiver ramos paralelos no mesmo nível (ex: duas CTAs diferentes saindo do mesmo ponto), elas
  // aparecem como etapas sequenciais em vez de lado a lado — sem grafo completo do fluxo não dá
  // pra distinguir os dois casos só pelas tags acumuladas.
  const contagemPorTag = new Map<string, number>()
  const somaPosicaoPorTag = new Map<string, number>()
  const contatosVistos = new Set<string>()
  for (const e of execucoes) {
    if (!e.contactId || contatosVistos.has(e.contactId)) continue
    contatosVistos.add(e.contactId)
    extrairTagsDaJornada(e.bruto).forEach((tag, posicao) => {
      contagemPorTag.set(tag, (contagemPorTag.get(tag) ?? 0) + 1)
      somaPosicaoPorTag.set(tag, (somaPosicaoPorTag.get(tag) ?? 0) + posicao)
    })
  }
  const estagiosTag = [...contagemPorTag.entries()]
    .map(([tag, contagem]) => ({ tag, contagem, posicaoMedia: somaPosicaoPorTag.get(tag)! / contagem }))
    .sort((a, b) => b.contagem - a.contagem || a.posicaoMedia - b.posicaoMedia)
    .map(({ tag, contagem }) => ({ tag, contagem }))

  // Enriquece cada execução com nome/telefone do lead — painel de análise mostra "quem" além de
  // "quantos", sem precisar de N chamadas separadas pra tela pedir um lead de cada vez.
  const contactIds = [...new Set(execucoes.map((e) => e.contactId).filter((id): id is string => !!id))]
  const leads = await listarBlacksenderLeadsPorIds(contactIds)
  const leadPorId = new Map(leads.map((l) => [l.id, l]))
  const execucoesComLead = execucoes.map((e) => ({
    ...e,
    leadNome: (e.contactId && leadPorId.get(e.contactId)?.nome) ?? null,
    leadTelefone: (e.contactId && leadPorId.get(e.contactId)?.telefone) ?? null,
  }))

  const ultimoLeadEm = execucoes[0]?.criadoEmOrigem ?? null

  return NextResponse.json({ flowId, total: execucoes.length, porStatus, estagiosTag, ultimoLeadEm, execucoes: execucoesComLead })
}
