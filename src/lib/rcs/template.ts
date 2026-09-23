import type { RcsContent, RcsSuggestion, RcsCard, RcsSmsFallback } from './tipos'
import { LIMITE_FALLBACK_TEXT } from './tipos'
import type { MensagemFluxo } from '@/components/funis/LeadConversaCard'

const TOKEN_RE = /\{\{([^}]+)\}\}/g

function aplicar(texto: string | undefined, variables?: Record<string, string>): string | undefined {
  if (texto == null) return texto
  if (!variables) return texto
  return texto.replace(TOKEN_RE, (m, nome) => variables[String(nome).trim()] ?? m)
}

function renderSuggestions(
  suggestions: RcsSuggestion[] | undefined,
  variables?: Record<string, string>,
): RcsSuggestion[] | undefined {
  if (!suggestions?.length) return undefined
  return suggestions.map((s) =>
    s.type === 'OPEN_URL'
      ? { type: 'OPEN_URL', text: aplicar(s.text, variables) ?? '', url: aplicar(s.url, variables) ?? '' }
      : { type: 'REPLY', text: aplicar(s.text, variables) ?? '', postbackData: s.postbackData },
  )
}

/** Resolve os tokens {{variavel}} do template com as variáveis de um destinatário e devolve o
 * `content` pronto pro body da Solvefy. */
export function renderizarRcsContent(
  conteudo: RcsContent,
  variables?: Record<string, string>,
): RcsContent {
  if (conteudo.type === 'text') {
    return {
      type: 'text',
      text: aplicar(conteudo.text, variables) ?? '',
      suggestions: renderSuggestions(conteudo.suggestions, variables),
    }
  }

  const c = conteudo.card
  const card: RcsCard = {
    title: aplicar(c.title, variables),
    description: aplicar(c.description, variables),
    media: c.media ? { url: aplicar(c.media.url, variables) ?? '', height: c.media.height } : undefined,
    orientation: c.orientation,
    suggestions: renderSuggestions(c.suggestions, variables),
  }
  // Remove chaves vazias — a Solvefy pode não gostar de title/description "" ou media sem url.
  if (!card.title) delete card.title
  if (!card.description) delete card.description
  if (!card.media?.url) delete card.media
  if (!card.suggestions) delete card.suggestions
  return { type: 'card', card }
}

/** A URL do 1º botão OPEN_URL do content (pra resolver {{link}} na copy do fallback). */
export function primeiroLinkRcs(conteudo: RcsContent): string | undefined {
  const sug = conteudo.type === 'card' ? conteudo.card.suggestions : conteudo.suggestions
  return sug?.find((s): s is Extract<RcsSuggestion, { type: 'OPEN_URL' }> => s.type === 'OPEN_URL')?.url
}

/** Renderiza o `fallback.text` por destinatário: resolve {{variavel}} e {{link}} (link = 1º
 * botão OPEN_URL do card, também com as variáveis aplicadas). */
export function renderizarFallbackText(
  fallback: RcsSmsFallback,
  conteudo: RcsContent,
  variables?: Record<string, string>,
): string {
  const link = aplicar(primeiroLinkRcs(conteudo), variables) ?? ''
  const comLink = fallback.text.replace(/\{\{\s*link\s*\}\}/gi, link)
  return aplicar(comLink, variables) ?? ''
}

/** Valida a config do fallback SMS. Retorna lista de erros (vazia = ok / desligado). */
export function validarFallback(fallback: RcsSmsFallback | null | undefined): string[] {
  if (!fallback?.enabled) return []
  const erros: string[] = []
  if (!fallback.from?.trim()) erros.push('fallback: remetente do SMS é obrigatório')
  if (!fallback.text?.trim()) erros.push('fallback: a copy do SMS é obrigatória')
  if ((fallback.text?.length ?? 0) > LIMITE_FALLBACK_TEXT)
    erros.push(`fallback: a copy passa de ${LIMITE_FALLBACK_TEXT} caracteres`)
  return erros
}

/** Lista os nomes de variável referenciados no template (pra casar com as colunas da base). */
export function extrairVariaveisRcs(conteudo: RcsContent): string[] {
  const alvos: string[] = []
  const push = (t?: string) => {
    if (!t) return
    let m: RegExpExecArray | null
    TOKEN_RE.lastIndex = 0
    while ((m = TOKEN_RE.exec(t))) alvos.push(m[1].trim())
  }

  if (conteudo.type === 'text') {
    push(conteudo.text)
    conteudo.suggestions?.forEach((s) => { push(s.text); if (s.type === 'OPEN_URL') push(s.url) })
  } else {
    const c = conteudo.card
    push(c.title)
    push(c.description)
    push(c.media?.url)
    c.suggestions?.forEach((s) => { push(s.text); if (s.type === 'OPEN_URL') push(s.url) })
  }
  return Array.from(new Set(alvos))
}

/** Um RcsContent (texto ou card) renderizado (variáveis já resolvidas) virando bolha de conversa —
 * mesmo formato que LeadConversaCard usa pras conversas de funil de tráfego (SendPulse/Black
 * Sender), reaproveitado pra dar a mesma visão de chat pros disparos de RCS (real e prévia). */
export function conteudoParaMensagem(id: string, criadoEm: string, conteudo: RcsContent, variables?: Record<string, string>): MensagemFluxo {
  const c = renderizarRcsContent(conteudo, variables)
  const sugestoes = c.type === 'card' ? c.card.suggestions : c.suggestions
  const botoesOferecidos = sugestoes?.length ? sugestoes.map((s) => s.text) : undefined
  if (c.type === 'card') {
    return {
      id, direcao: 'saida', criadoEm,
      tipo: c.card.media?.url ? 'imagem' : 'texto',
      titulo: c.card.title || undefined,
      texto: c.card.description || undefined,
      imagemUrl: c.card.media?.url,
      botoesOferecidos,
    }
  }
  return { id, direcao: 'saida', criadoEm, tipo: 'texto', texto: c.text, botoesOferecidos }
}

/** O clique do lead num botão Resposta (REPLY) do conteúdo — vira bolha "entrada" do tipo
 * botao_clicado. Sem REPLY configurado, cai no 1º botão qualquer (não deveria acontecer na
 * prática: só chamamos isso quando já sabemos que houve clique registrado). */
export function cliqueParaMensagem(id: string, criadoEm: string, conteudo: RcsContent): MensagemFluxo {
  const sugestoes = conteudo.type === 'card' ? conteudo.card.suggestions : conteudo.suggestions
  const botao = sugestoes?.find((s) => s.type === 'REPLY') ?? sugestoes?.[0]
  return { id, direcao: 'entrada', criadoEm, tipo: 'botao_clicado', botaoTitulo: botao?.text || 'clique' }
}

/** Valida o esqueleto do template antes de salvar/disparar. Retorna lista de erros (vazia = ok). */
export function validarRcsContent(conteudo: RcsContent | null | undefined): string[] {
  const erros: string[] = []
  if (!conteudo) return ['conteúdo vazio']

  if (conteudo.type === 'text') {
    if (!conteudo.text?.trim()) erros.push('texto é obrigatório')
    for (const s of conteudo.suggestions ?? []) {
      if (!s.text?.trim()) erros.push('botão sem texto')
      if (s.type === 'OPEN_URL' && !/^https?:\/\//i.test(s.url ?? '')) erros.push(`botão "${s.text}" sem URL válida`)
      if (s.type === 'REPLY' && !s.postbackData?.trim()) erros.push(`botão "${s.text}" sem postbackData`)
    }
    if ((conteudo.suggestions?.length ?? 0) > 4) erros.push('máximo de 4 botões (limite do RCS)')
  } else if (conteudo.type === 'card') {
    const c = conteudo.card
    if (!c) erros.push('card vazio')
    else {
      if (!c.title?.trim() && !c.description?.trim() && !c.media?.url?.trim()) {
        erros.push('o card precisa de pelo menos título, descrição ou imagem')
      }
      if (c.media && !/^https?:\/\//i.test(c.media.url ?? '')) {
        erros.push('a imagem do card precisa de uma URL http(s)')
      }
      for (const s of c.suggestions ?? []) {
        if (!s.text?.trim()) erros.push('botão sem texto')
        if (s.type === 'OPEN_URL' && !/^https?:\/\//i.test(s.url ?? '')) erros.push(`botão "${s.text}" sem URL válida`)
        if (s.type === 'REPLY' && !s.postbackData?.trim()) erros.push(`botão "${s.text}" sem postbackData`)
      }
      if ((c.suggestions?.length ?? 0) > 4) erros.push('máximo de 4 botões no card (limite do RCS)')
    }
  } else {
    erros.push(`tipo de conteúdo não suportado ainda`)
  }
  return erros
}
