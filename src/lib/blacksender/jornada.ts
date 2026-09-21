// Helpers puros (sem acesso a banco) pra extrair a jornada de tags e o canal de um fluxo Black
// Sender a partir do JSON cru (`bruto`) de cada execução — usado tanto pela rota
// /api/blacksender/fluxos/[flowId] (painel de análise) quanto pelo comando /leads do Discord, pra
// não duplicar a lógica de agregação nos dois lugares.

import type { BlacksenderFlowRun } from '@/types'
import type { EstagioFunil } from '@/components/funis/FunilConversaoChart'

/** As tags acumuladas da jornada do lead vêm dentro do JSON cru da Black Sender (mesma convenção
 * de nome que o SendPulse — LEAD_X, FC_X, CTA_X... — dá pra crer que o fluxo foi portado de lá),
 * em `variables.tags`, crescendo conforme o lead avança nos nós do fluxo. Não documentado/tipado
 * pela Black Sender (é o payload bruto do node builder deles), então extrai defensivamente. */
export function extrairTagsDaJornada(bruto: unknown): string[] {
  if (!bruto || typeof bruto !== 'object') return []
  const variables = (bruto as { variables?: unknown }).variables
  if (!variables || typeof variables !== 'object') return []
  const tags = (variables as { tags?: unknown }).tags
  return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : []
}

/** channel_id (número WhatsApp) que rodou a execução — vem direto no JSON cru, não é uma coluna
 * mapeada em BlacksenderFlowRun (ver tb('blacksender_flow_runs').select('*') em
 * listarBlacksenderFlowRuns). */
export function extrairCanalId(bruto: unknown): string | null {
  if (!bruto || typeof bruto !== 'object') return null
  const v = (bruto as { channel_id?: unknown }).channel_id
  return typeof v === 'string' ? v : null
}

/** Funil de conversão da jornada (mesma visão do FunilConversaoChart do SendPulse, mas com tags
 * que vêm prontas da Black Sender em vez de configuradas manualmente): usa só a execução mais
 * recente de cada contato (assume `execucoes` já ordenado por criado_em_origem desc, como
 * listarBlacksenderFlowRuns devolve — o primeiro que aparece por contactId é o mais atual), soma
 * quantos contatos únicos já acumularam cada tag, e ordena por contagem desc (a etapa de entrada
 * sempre tem mais leads que as seguintes) com a posição média dentro da jornada como desempate.
 * `contatosFiltro`, se passado, restringe a contagem só a esses contactIds (ex: só os leads novos
 * de um dia específico) — sem isso, considera todos os contatos que já passaram pelo fluxo.
 * Aproximação: se o fluxo tiver ramos paralelos no mesmo nível (ex: duas CTAs diferentes saindo
 * do mesmo ponto), elas aparecem como etapas sequenciais em vez de lado a lado — sem grafo
 * completo do fluxo não dá pra distinguir os dois casos só pelas tags acumuladas. */
export function calcularEstagiosTag(execucoes: BlacksenderFlowRun[], contatosFiltro?: Set<string>): EstagioFunil[] {
  const contagemPorTag = new Map<string, number>()
  const somaPosicaoPorTag = new Map<string, number>()
  const contatosVistos = new Set<string>()
  for (const e of execucoes) {
    if (!e.contactId || contatosVistos.has(e.contactId)) continue
    if (contatosFiltro && !contatosFiltro.has(e.contactId)) continue
    contatosVistos.add(e.contactId)
    extrairTagsDaJornada(e.bruto).forEach((tag, posicao) => {
      contagemPorTag.set(tag, (contagemPorTag.get(tag) ?? 0) + 1)
      somaPosicaoPorTag.set(tag, (somaPosicaoPorTag.get(tag) ?? 0) + posicao)
    })
  }
  return [...contagemPorTag.entries()]
    .map(([tag, contagem]) => ({ tag, contagem, posicaoMedia: somaPosicaoPorTag.get(tag)! / contagem }))
    .sort((a, b) => b.contagem - a.contagem || a.posicaoMedia - b.posicaoMedia)
    .map(({ tag, contagem }) => ({ tag, contagem }))
}

/** Canal (número WhatsApp) de um fluxo — pega o primeiro channel_id não-nulo entre as execuções.
 * Um fluxo pode, em teoria, rodar em mais de um canal (trigger por keyword sem canal fixo), mas
 * na prática cada fluxo configurado corresponde a um número — suficiente pra achar "quem mais
 * roda nesse mesmo número" sem precisar de um campo dedicado. */
export function canalDoFluxo(execucoes: BlacksenderFlowRun[]): string | null {
  for (const e of execucoes) {
    const canal = extrairCanalId(e.bruto)
    if (canal) return canal
  }
  return null
}
