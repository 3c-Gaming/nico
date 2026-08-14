// Reconstrói a conversa de um contato dentro de um fluxo específico, cruzando
// /chats/messages (histórico completo do contato) com o campo "chain" que a SendPulse
// devolve nas mensagens de SAÍDA (chain.id = flow_id, chain.block_id = bloco do fluxo
// que mandou aquela mensagem — não documentado no OpenAPI, confirmado testando ao vivo).
//
// Mensagens de ENTRADA (respostas do lead) não têm "chain" — só dá pra saber de qual
// fluxo elas vieram olhando o campo data.context.message_id, que aponta pro wamid da
// mensagem de saída que o lead respondeu. Por isso o fluxo aqui é: 1) mapear wamid ->
// chain de todas as mensagens de saída, 2) pra cada mensagem de entrada, resolver o
// chain via a mensagem que ela respondeu.
//
// Importante: clique em botão de LINK (cta_url, abre URL externa) não gera mensagem de
// volta — o WhatsApp não reporta esse clique pro bot, só reporta clique em botão de
// resposta rápida (button_reply/list_reply). Então dá pra saber que um link foi
// ENVIADO, nunca que foi CLICADO.

import { listarContasSendpulse } from './contasSendpulse'

const BASE_URL = 'https://api.sendpulse.com/whatsapp'
const TAMANHO_PAGINA = 100
// Trava de segurança — histórico de um único contato não deveria chegar nem perto disso.
const MAX_MENSAGENS = 2000

function getHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MensagemBruta = any

/** Busca o histórico completo de mensagens de um contato, já sabendo a API key certa
 * (ex: quando o chamador já tem o botId e resolveu a conta via apiKeyParaBot). */
export async function buscarMensagensDoContatoNaConta(apiKey: string, contactId: string): Promise<MensagemBruta[]> {
  const todas: MensagemBruta[] = []
  let skip = 0
  while (todas.length < MAX_MENSAGENS) {
    const res = await fetch(
      `${BASE_URL}/chats/messages?contact_id=${encodeURIComponent(contactId)}&order=asc&size=${TAMANHO_PAGINA}&skip=${skip}`,
      { headers: getHeaders(apiKey) },
    )
    if (!res.ok) throw new Error(`Sendpulse chats/messages error ${res.status}`)
    const json = await res.json()
    if (!json.success) throw new Error('Sendpulse chats/messages: success=false')
    const pagina: MensagemBruta[] = json.data ?? []
    todas.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) break
    skip += TAMANHO_PAGINA
  }
  return todas
}

/** Um contact_id pertence a uma conta SendPulse específica, mas o chamador só tem o
 * contact_id (sem bot_id) — tenta cada conta configurada até uma responder com
 * sucesso, mesmo padrão de obterTelefonePorContactId em integrações/sendpulse.ts. */
export async function buscarMensagensDoContato(contactId: string): Promise<MensagemBruta[]> {
  let ultimoErro: unknown
  for (const conta of listarContasSendpulse()) {
    try {
      return await buscarMensagensDoContatoNaConta(conta.apiKey, contactId)
    } catch (err) {
      ultimoErro = err
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(`Nenhuma conta SendPulse reconheceu o contato ${contactId}`)
}

export interface ContatoResumo {
  contactId: string
  nome: string
  telefone: string
  ultimaAtividade: string
  tags: string[]
  variaveis: Record<string, unknown>
}

/** getByTag devolve os contatos ordenados do mais recente pro mais antigo (confirmado —
 * ver contarPorTagHojeSendpulse), então pegar os N primeiros já dá os leads mais
 * recentes daquela tag sem precisar ordenar na mão. */
export async function buscarUltimosContatosPorTag(
  botId: string,
  tag: string,
  apiKey: string,
  quantidade: number,
): Promise<ContatoResumo[]> {
  const url = `${BASE_URL}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=${quantidade}`
  const res = await fetch(url, { headers: getHeaders(apiKey) })
  if (!res.ok) throw new Error(`Sendpulse getByTag error ${res.status}`)
  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((json.data ?? []) as any[]).map((c) => ({
    contactId: String(c.id ?? ''),
    nome: c.channel_data?.name || c.channel_data?.first_name || '',
    telefone: c.channel_data?.username || '',
    ultimaAtividade: c.last_activity_at || c.created_at || '',
    tags: c.tags ?? [],
    variaveis: c.variables ?? {},
  }))
}

export interface MensagemFluxo {
  id: string
  direcao: 'entrada' | 'saida'
  criadoEm: string
  tipo: 'texto' | 'imagem' | 'documento' | 'audio' | 'video' | 'botao_clicado' | 'lista_selecionada' | 'link_enviado' | 'outro'
  texto?: string
  botaoTitulo?: string
  linkUrl?: string
  linkTexto?: string
  imagemUrl?: string
  chainId?: string
  blockId?: string
}

interface Chain {
  chainId?: string
  blockId?: string
}

function extrairChain(msg: MensagemBruta): Chain {
  if (msg.chain?.id) return { chainId: msg.chain.id, blockId: msg.chain.block_id }
  return {}
}

function wamidDaMensagem(msg: MensagemBruta): string | undefined {
  return msg.data?.message_id ?? msg.data?.id
}

function wamidDeResposta(msg: MensagemBruta): string | undefined {
  return msg.data?.context?.message_id
}

function normalizarMensagem(msg: MensagemBruta, chain: Chain): MensagemFluxo {
  const data = msg.data ?? {}
  const interactive = data.interactive

  let tipo: MensagemFluxo['tipo'] = 'outro'
  let texto: string | undefined
  let botaoTitulo: string | undefined
  let linkUrl: string | undefined
  let linkTexto: string | undefined
  let imagemUrl: string | undefined

  if (typeof data.text?.body === 'string') {
    tipo = 'texto'
    texto = data.text.body
  } else if (typeof data.text === 'string') {
    tipo = 'texto'
    texto = data.text
  } else if (data.image) {
    tipo = 'imagem'
    texto = data.image.caption ?? undefined
    imagemUrl = data.image.link ?? undefined
  } else if (data.file || data.document) {
    tipo = 'documento'
    texto = (data.file ?? data.document)?.caption ?? undefined
  } else if (data.audio) {
    tipo = 'audio'
  } else if (data.video) {
    tipo = 'video'
  } else if (interactive?.type === 'cta_url') {
    tipo = 'link_enviado'
    texto = interactive.body?.text
    linkTexto = interactive.action?.parameters?.display_text
    linkUrl = interactive.action?.parameters?.url
  } else if (interactive?.type === 'button_reply') {
    tipo = 'botao_clicado'
    botaoTitulo = interactive.button_reply?.title
  } else if (interactive?.type === 'list_reply') {
    tipo = 'lista_selecionada'
    botaoTitulo = interactive.list_reply?.title
  } else if (typeof interactive?.body?.text === 'string') {
    tipo = 'texto'
    texto = interactive.body.text
  }

  return {
    id: String(msg.id ?? ''),
    direcao: msg.direction === 1 ? 'entrada' : 'saida',
    criadoEm: msg.created_at,
    tipo,
    texto,
    botaoTitulo,
    linkUrl,
    linkTexto,
    imagemUrl,
    chainId: chain.chainId,
    blockId: chain.blockId,
  }
}

/** Filtra e ordena as mensagens de um contato pra só as que pertencem ao fluxo indicado
 * (flow_id = chain.id). Mensagens de entrada são correlacionadas via data.context.message_id
 * -> chain da mensagem de saída que elas respondem (reply/swipe explícito). Uma mensagem
 * avulsa do lead (não responde nada específico) não tem esse campo — nesse caso assume que
 * ela ainda pertence à conversa do último fluxo que mandou algo pra ele (acompanhado
 * cronologicamente), já que na prática é disso que se trata: o lead respondendo livremente
 * dentro daquela janela de conversa, só sem usar o swipe-to-reply do WhatsApp. */
export function filtrarConversaPorFluxo(mensagensBrutas: MensagemBruta[], flowId: string): MensagemFluxo[] {
  const mensagensOrdenadas = [...mensagensBrutas].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))

  const chainPorWamid = new Map<string, Chain>()
  for (const msg of mensagensOrdenadas) {
    const chain = extrairChain(msg)
    if (chain.chainId) {
      const wamid = wamidDaMensagem(msg)
      if (wamid) chainPorWamid.set(wamid, chain)
    }
  }

  const resultado: MensagemFluxo[] = []
  let chainAtual: Chain = {}
  for (const msg of mensagensOrdenadas) {
    let chain = extrairChain(msg)
    if (!chain.chainId) {
      const respondendoA = wamidDeResposta(msg)
      const resolvido = respondendoA ? chainPorWamid.get(respondendoA) : undefined
      if (resolvido) chain = resolvido
    }
    if (!chain.chainId && msg.direction === 1) chain = chainAtual
    if (chain.chainId) chainAtual = chain
    if (chain.chainId === flowId) resultado.push(normalizarMensagem(msg, chain))
  }
  return resultado
}
