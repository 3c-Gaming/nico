import type { NumeroSendpulse, FluxoSendpulse, ChatAtivoSendpulse, EstatisticasBotSendpulse, RelatorioCampanhaSendpulse, ResumoDestinatariosCampanha, DestinatarioComClique } from '@/types'
import { listarContasSendpulse, registrarContaDoBot, registrarCanalDoBot, apiKeyParaBot } from './contasSendpulse'
import { hojeBrasilISO, dataParaBrasilISO } from '@/lib/datas'
import { getPreferencias } from '@/lib/db/supabase'
import { getOrFetch } from '@/lib/cache'

/** Nome amigável que o usuário deu à conta na tela de Configurações sobrepõe o nome vindo do
 * .env (SENDPULSE_NN_NOME) — sem isso, contas sem essa env var preenchida caem no fallback
 * genérico "Conta 01"/"Conta 02" pra sempre, sem jeito de trocar sem redeploy. */
async function resolverNomesContas(): Promise<Record<string, string>> {
  try {
    return (await getPreferencias()).contaNomes
  } catch {
    return {}
  }
}

export type Canal = 'whatsapp' | 'telegram'

// A SendPulse expõe um namespace REST quase idêntico por canal (confirmado testando ao vivo:
// /telegram/bots, /telegram/flows e /telegram/bots/statistics respondem com a mesma forma dos
// equivalentes /whatsapp/...) — só muda o channel_data de cada bot (telefone vs username/id do
// Telegram). Por isso quase tudo aqui vira um parametrizar-por-canal em vez de duplicar funções.
function baseUrl(canal: Canal): string {
  return `https://api.sendpulse.com/${canal}`
}

function getHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

/** Retry com backoff exponencial só pra 429 ("max 30 requests per minute", limite por conta da
 * SendPulse) — fácil de estourar em telas que buscam algo por número/fluxo/bot em lote (uma conta
 * pode ter 70+ números). Outros status voltam direto pro chamador, sem retry (não adianta
 * re-tentar um bot_id que genuinamente não existe). Mesmo padrão de
 * sendpulseConversaFluxo.ts:fetchSendpulseComRetry. */
async function fetchComRetry429(url: string, apiKey: string, signal?: AbortSignal, tentativas = 4): Promise<Response> {
  let ultimaResposta: Response
  for (let i = 0; i < tentativas; i++) {
    ultimaResposta = await fetch(url, { headers: getHeaders(apiKey), signal })
    if (ultimaResposta.status !== 429) return ultimaResposta
    if (i < tentativas - 1) await new Promise((r) => setTimeout(r, 1000 * 2 ** i))
  }
  return ultimaResposta!
}

function traduzirStatusBot(status: number): 'ativo' | 'inativo' {
  return status === 3 ? 'ativo' : 'inativo'
}

function traduzirStatusFlow(status: number): 'ativo' | 'inativo' | 'rascunho' {
  if (status === 1) return 'ativo'
  if (status === 2) return 'inativo'
  return 'rascunho'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearBotParaNumero(bot: any, canal: Canal): NumeroSendpulse {
  const numero = canal === 'telegram'
    ? (bot.channel_data?.username ? `@${bot.channel_data.username}` : String(bot.channel_data?.id ?? ''))
    : String(bot.channel_data?.phone ?? '')
  const nome = canal === 'telegram'
    ? (bot.channel_data?.full_name ?? bot.channel_data?.name ?? '')
    : (bot.channel_data?.name ?? '')
  return {
    id: bot.id,
    canal,
    numero,
    nome,
    status: traduzirStatusBot(bot.status),
    inboxTotal: bot.inbox?.total ?? 0,
    inboxNaoLidas: bot.inbox?.unread ?? 0,
  }
}

export async function listarNumeros(apiKey: string, canal: Canal, signal?: AbortSignal): Promise<NumeroSendpulse[]> {
  const res = await fetchComRetry429(`${baseUrl(canal)}/bots`, apiKey, signal)
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  return (json.data ?? []).map((bot: unknown) => mapearBotParaNumero(bot, canal))
}

// Conta com plano expirado/excedido na SendPulse ainda aceita a maioria das chamadas de leitura —
// filtrar isso globalmente (dentro de listarNumerosTodasContas) faria números de disparo sumirem
// de Disparos/monitoramento/crons sem aviso. Por isso o filtro fica opt-in, exposto aqui só como
// helper (ver uso em /api/sendpulse/numeros com ?apenasContasAtivas=true, hoje só a tela de
// Funis) — cada consumidor decide se quer esconder conta expirada ou não. Cache curto porque isso
// chama /whatsapp/account por conta a cada vez (ver buscarStatusPlanoTodasContas).
const TTL_STATUS_PLANO_MS = 5 * 60_000

export async function idsContasComPlanoAtivo(): Promise<Set<string>> {
  const contas = listarContasSendpulse()
  const status = await getOrFetch('sendpulse-status-plano', 'todas', TTL_STATUS_PLANO_MS, () => buscarStatusPlanoTodasContas())
  const statusPorConta = new Map(status.map((s) => [s.contaId, s]))
  const ativas = contas.filter((conta) => {
    const s = statusPorConta.get(conta.id)
    // Sem resposta de status (erro pontual, timeout) não bloqueia a conta — só some quando a
    // SendPulse confirma expirado/excedido.
    if (!s) return true
    return !s.isExpired && !s.isExceeded
  })
  return new Set(ativas.map((c) => c.id))
}

/** Busca números de TODAS as contas configuradas (e, por padrão, só do canal WhatsApp — passe
 * `canais` pra incluir Telegram também) em paralelo e mescla — uma conta ou canal falhando não
 * derruba os outros. Marca cada número com contaId/contaNome e registra o mapeamento bot->conta/
 * canal pra outras chamadas (fluxos, status, tags) saberem qual API key/canal usar sem precisar
 * buscar todos os números de novo. `signal` mantido na 1ª posição (não antes de `canais`) pra não
 * quebrar os vários call sites existentes que já chamam listarNumerosTodasContas(signal) — default
 * só-WhatsApp preserva o comportamento de todo chamador existente que não sabe de Telegram. Inclui
 * contas com plano expirado/excedido (ver idsContasComPlanoAtivo pra quem precisa filtrar isso). */
export async function listarNumerosTodasContas(signal?: AbortSignal, canais: Canal[] = ['whatsapp']): Promise<NumeroSendpulse[]> {
  const contas = listarContasSendpulse()
  const [resultados, nomesPersonalizados] = await Promise.all([
    Promise.allSettled(
      contas.flatMap((conta) => canais.map((canal) =>
        listarNumeros(conta.apiKey, canal, signal).then((numeros) => ({ conta, numeros })),
      )),
    ),
    resolverNomesContas(),
  ])

  const todos: NumeroSendpulse[] = []
  for (const r of resultados) {
    if (r.status !== 'fulfilled') continue
    const { conta, numeros } = r.value
    for (const numero of numeros) {
      registrarContaDoBot(numero.id, conta.id)
      registrarCanalDoBot(numero.id, numero.canal)
      todos.push({ ...numero, contaId: conta.id, contaNome: nomesPersonalizados[conta.id] ?? conta.nome })
    }
  }
  return todos
}

/** Acha em qual conta SendPulse configurada mora um bot de Telegram específico, a partir do
 * identificador salvo no Disparo (o mesmo `numero` — "@username" ou id — que listarNumeros
 * devolve). Usado pelo disparo de Telegram via CSV pra saber qual apiKey usar na hora de resolver
 * contatos, sem precisar guardar contaId/apiKey direto no Disparo. */
export async function resolverContaEBotTelegram(botIdentificador: string): Promise<{ apiKey: string; botId: string } | null> {
  const contas = listarContasSendpulse()
  for (const conta of contas) {
    try {
      const bots = await listarNumeros(conta.apiKey, 'telegram')
      const bot = bots.find((b) => b.numero === botIdentificador || b.id === botIdentificador)
      if (bot) return { apiKey: conta.apiKey, botId: bot.id }
    } catch {
      // conta sem telegram configurado ou erro pontual — tenta a próxima
    }
  }
  return null
}

const STATS_VAZIA = { all: 0, sent: 0, rejected: 0, delivered: 0, opened: 0, redirected: 0 }

/** Campanha de broadcast criada direto no painel da SendPulse (não pelo nico) — só existe
 * `/campaigns/report?id=`, sem endpoint de listagem (ver AI/sendpulse-api.md). `null` se o ID não
 * existir NESSA conta especificamente (ver resolverContaDaCampanha, que tenta todas) — plano
 * expirado também cai aqui (a SendPulse recusa o endpoint com "Available only on a paid tariff"). */
export async function buscarCampanhaSendpulse(campanhaId: string, apiKey: string, canal: Canal = 'telegram'): Promise<RelatorioCampanhaSendpulse | null> {
  const res = await fetchComRetry429(`${baseUrl(canal)}/campaigns/report?id=${encodeURIComponent(campanhaId)}`, apiKey)
  if (!res.ok) return null
  const json = await res.json()
  if (!json.success || !json.data) return null
  const d = json.data
  return {
    id: d.id,
    titulo: d.title ?? '',
    botId: d.bot_id ?? '',
    status: d.status ?? 0,
    sendAt: d.send_at ?? null,
    criadoEm: d.created_at ?? '',
    atualizadoEm: d.updated_at ?? '',
    stats: {
      mensagens: d.stats?.messages ?? STATS_VAZIA,
      destinatarios: d.stats?.recipients ?? STATS_VAZIA,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      botoes: ((d.stats?.buttons ?? []) as any[]).map((b) => ({
        titulo: String(b.title ?? ''),
        total: Number(b.non_unique ?? 0),
        unicos: Number(b.unique ?? 0),
      })),
    },
  }
}

// Trava de paginação — campanha com muitos milhares de destinatários não precisa ser escaneada
// inteira pra um resumo de engajamento ser representativo, e evita uma requisição que nunca
// termina. `escaneados` no resultado avisa quando o corte pegou antes do fim.
const MAX_DESTINATARIOS_ESCANEADOS = 2000
const TAMANHO_PAGINA_DESTINATARIOS = 100
const MAX_QUEM_CLICOU = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nomeContato(contact: any): { nome: string; username: string | null } {
  // Contato de campanha vem soltos no nível raiz (full_name/first_name/username), diferente do
  // contato de getByTag (aninhado em channel_data) — confirmado testando ao vivo.
  const dados = contact ?? {}
  const nome = dados.full_name || dados.name || dados.first_name || 'Sem nome'
  const username = dados.username ? `@${dados.username}` : null
  return { nome, username }
}

/** Agrega campaigns/recipients — traz clique POR BOTÃO (cada botão da mensagem tem seu próprio
 * contador), não só o clique agregado da campanha (que /campaigns/report já dá). Pagina com
 * search_after (cursor da própria SendPulse) até acabar ou bater o teto de segurança. */
export async function buscarDestinatariosCampanha(campanhaId: string, apiKey: string, canal: Canal = 'telegram'): Promise<ResumoDestinatariosCampanha> {
  let total = 0
  let escaneados = 0
  let entregues = 0
  let abriram = 0
  let clicaram = 0
  let comAtividade = 0
  let rejeitados = 0
  const porBotao = new Map<string, number>()
  const quemClicou: DestinatarioComClique[] = []
  const motivosRejeicao = new Map<string, number>()

  let searchAfter: string[] | undefined
  for (;;) {
    const params = new URLSearchParams({ id: campanhaId, size: String(TAMANHO_PAGINA_DESTINATARIOS) })
    if (searchAfter?.length) params.set('search_after', searchAfter.join(','))
    const res = await fetchComRetry429(`${baseUrl(canal)}/campaigns/recipients?${params.toString()}`, apiKey)
    if (!res.ok) break
    const json = await res.json()
    if (!json.success || !json.data) break

    total = json.data.total ?? total
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pagina = (json.data.list ?? []) as any[]
    if (pagina.length === 0) break

    for (const dest of pagina) {
      escaneados++
      if (dest.delivered) entregues++
      if (dest.opened) abriram++
      if (dest.activity) comAtividade++
      if (dest.rejected) {
        rejeitados++
        // Uma campanha manda mais de uma mensagem (ex: foto + texto) — o mesmo motivo pode
        // aparecer repetido no array pro mesmo destinatário. Conta 1 destinatário por motivo
        // distinto, não 1 por mensagem falhada (senão "quantos bloquearam" fica inflado).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const motivosDesteContato = new Set(((dest.errors ?? []) as any[]).map((e) => String(e)))
        for (const motivo of motivosDesteContato) {
          motivosRejeicao.set(motivo, (motivosRejeicao.get(motivo) ?? 0) + 1)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const botoes = (dest.buttons ?? []) as any[]
      const botoesClicadosDesteContato: string[] = []
      for (const b of botoes) {
        const cliques = Number(b.clicks ?? 0)
        if (cliques > 0) {
          porBotao.set(b.title, (porBotao.get(b.title) ?? 0) + cliques)
          botoesClicadosDesteContato.push(b.title)
        }
      }

      if (dest.clicked) {
        clicaram++
        if (quemClicou.length < MAX_QUEM_CLICOU) {
          const { nome, username } = nomeContato(dest.contact)
          quemClicou.push({ nome, username, botoesClicados: botoesClicadosDesteContato })
        }
      }
    }

    searchAfter = json.data.search_after
    if (!searchAfter?.length || pagina.length < TAMANHO_PAGINA_DESTINATARIOS || escaneados >= MAX_DESTINATARIOS_ESCANEADOS) break
  }

  return {
    total,
    escaneados,
    entregues,
    abriram,
    clicaram,
    comAtividade,
    rejeitados,
    porBotao: [...porBotao.entries()].map(([titulo, cliques]) => ({ titulo, cliques })).sort((a, b) => b.cliques - a.cliques),
    quemClicou,
    motivosRejeicao: [...motivosRejeicao.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
  }
}

/** Sem saber de antemão em qual das contas configuradas a campanha foi criada — tenta cada uma
 * até achar (mesmo princípio de resolverContaEBotTelegram). */
export async function resolverContaDaCampanha(campanhaId: string, canal: Canal = 'telegram'): Promise<{ contaId: string; relatorio: RelatorioCampanhaSendpulse } | null> {
  for (const conta of listarContasSendpulse()) {
    const relatorio = await buscarCampanhaSendpulse(campanhaId, conta.apiKey, canal)
    if (relatorio) return { contaId: conta.id, relatorio }
  }
  return null
}

/** Aceita tanto o ID cru quanto o link do painel da SendPulse (ex:
 * https://login.sendpulse.com/messengers/campaign/telegram/{id}/report/) — o usuário só tem
 * acesso ao link colando da barra de endereço do painel, então extrai o ID de qualquer um dos
 * dois formatos. `null` se não achar nada parecido com um ID de campanha (24 chars hex). */
export function extrairIdCampanhaSendpulse(input: string): string | null {
  const doLink = input.match(/\/campaign\/(?:telegram|whatsapp|messenger)\/([a-f0-9]{24})/i)
  if (doLink) return doLink[1]
  const bruto = input.trim().match(/^[a-f0-9]{24}$/i)
  return bruto ? bruto[0] : null
}

export interface TagSendpulse {
  id: string
  nome: string
  contagem: number
}

// A SendPulse limita esse endpoint a 100 resultados por página independente do `limit` pedido, e
// ignora `offset` (mesma pegadinha do /contacts — confirmado ao vivo) — `skip` é o parâmetro
// certo, igual usado em getByTag logo abaixo.
const TAMANHO_PAGINA_TAGS = 100

/** Lista as tags criadas nesse bot, com quantos contatos cada uma tem — usado pra montar um
 * disparo direto de uma tag da SendPulse, sem precisar de CSV externo. */
export async function listarTagsSendpulse(botId: string, apiKey: string, canal: Canal = 'whatsapp'): Promise<TagSendpulse[]> {
  const tags: TagSendpulse[] = []
  let skip = 0
  for (;;) {
    const res = await fetchComRetry429(`${baseUrl(canal)}/tags?bot_id=${encodeURIComponent(botId)}&skip=${skip}`, apiKey)
    if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pagina = (json.data ?? []) as any[]
    for (const t of pagina) tags.push({ id: t.id, nome: t.name, contagem: t.count ?? 0 })
    if (pagina.length < TAMANHO_PAGINA_TAGS) break
    skip += TAMANHO_PAGINA_TAGS
  }
  return tags
}

export interface ContatoCompletoSendpulse {
  contactId: string
  telegramId: number | null
  username: string | null
  nome: string
}

/** Todos os contatos de uma tag (sem filtro de data, diferente de contarPorTagIntervaloSendpulse)
 * — já vem com telegram_id direto da SendPulse, então dispara pra 100% da tag, não só quem tem
 * @username público (limitação do fluxo via CSV, que precisa casar por username). */
export async function buscarContatosCompletosPorTag(botId: string, tag: string, apiKey: string, canal: Canal = 'whatsapp'): Promise<ContatoCompletoSendpulse[]> {
  const contatos: ContatoCompletoSendpulse[] = []
  let skip = 0
  for (;;) {
    const url = `${baseUrl(canal)}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=${TAMANHO_PAGINA_GETBYTAG}&skip=${skip}`
    const res = await fetchComRetry429(url, apiKey)
    if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pagina = (json.data ?? []) as any[]
    if (pagina.length === 0) break
    for (const c of pagina) {
      contatos.push({
        contactId: c.id,
        telegramId: c.telegram_id ?? null,
        username: c.channel_data?.username ?? null,
        nome: c.channel_data?.name ?? c.channel_data?.first_name ?? '',
      })
    }
    if (pagina.length < TAMANHO_PAGINA_GETBYTAG) break
    skip += TAMANHO_PAGINA_GETBYTAG
  }
  return contatos
}

export interface StatusPlanoSendpulse {
  contaId: string
  contaNome: string
  tariffCode: string
  isExpired: boolean
  isExceeded: boolean
  expiredAt: string | null
  maxContacts: number
  maxBots: number
}

async function buscarStatusPlano(conta: { id: string; nome: string; apiKey: string }, nomesPersonalizados: Record<string, string>, signal?: AbortSignal): Promise<StatusPlanoSendpulse> {
  const res = await fetchComRetry429(`${baseUrl('whatsapp')}/account`, conta.apiKey, signal)
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const t = json.data?.tariff ?? {}
  return {
    contaId: conta.id,
    contaNome: nomesPersonalizados[conta.id] ?? conta.nome,
    tariffCode: t.code ?? '',
    isExpired: !!t.is_expired,
    isExceeded: !!t.is_exceeded,
    expiredAt: t.expired_at ?? null,
    maxContacts: t.max_contacts ?? -1,
    maxBots: t.max_bots ?? -1,
  }
}

/** Status do plano/tarifa de todas as contas SendPulse configuradas — usado pra alertar
 * quando um plano já expirou ou está perto de expirar (a SendPulse não avisa sozinha). */
export async function buscarStatusPlanoTodasContas(signal?: AbortSignal): Promise<StatusPlanoSendpulse[]> {
  const contas = listarContasSendpulse()
  const nomesPersonalizados = await resolverNomesContas()
  const resultados = await Promise.allSettled(contas.map((conta) => buscarStatusPlano(conta, nomesPersonalizados, signal)))
  return resultados
    .filter((r): r is PromiseFulfilledResult<StatusPlanoSendpulse> => r.status === 'fulfilled')
    .map((r) => r.value)
}

// canal por último (não antes de signal) pra não quebrar os call sites existentes que já passam
// um AbortSignal na 3ª posição — default 'whatsapp' preserva o comportamento de todos eles.
export async function listarFluxos(botId: string, apiKey: string, signal?: AbortSignal, canal: Canal = 'whatsapp'): Promise<FluxoSendpulse[]> {
  const res = await fetchComRetry429(`${baseUrl(canal)}/flows?bot_id=${encodeURIComponent(botId)}`, apiKey, signal)
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.data ?? []).map((flow: any) => ({
    id: flow.id,
    botId: flow.bot_id,
    nome: flow.name,
    status: traduzirStatusFlow(flow.status),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    triggers: (flow.triggers ?? []).map((t: any) => ({ id: t.id, nome: t.name, tipo: t.type })),
  }))
}

export async function obterStatusBot(botId: string, apiKey: string, signal?: AbortSignal, canal: Canal = 'whatsapp'): Promise<EstatisticasBotSendpulse> {
  const res = await fetchComRetry429(`${baseUrl(canal)}/bots/statistics?bot_id=${encodeURIComponent(botId)}`, apiKey, signal)
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const d = json.data ?? {}
  return {
    totalInscritos: d.subscribed_total_count ?? 0,
    ativosInscritos: d.subscribed_active_count ?? 0,
    totalMensagensEnviadas: d.outgoing_messages_total_count ?? 0,
  }
}

export interface ContagemTagHoje {
  total: number
  hoje: number
  ultimoLeadAt: string | null
}

/**
 * Busca direto na API da SendPulse (getByTag) — `meta.total` já vem certo mesmo pedindo poucos
 * registros, e os contatos voltam ordenados do mais recente pro mais antigo, então os de hoje
 * sempre estão no topo da lista (sem risco de "sumir" mesmo em tags com milhares de contatos
 * acumulados), sem precisar paginar. Pra intervalos de mais de um dia, ver
 * `contarPorTagIntervaloSendpulse` — mesma ideia, mas pagina até cobrir o intervalo inteiro.
 */
export async function contarPorTagHojeSendpulse(botId: string, tag: string, apiKey: string, signal?: AbortSignal, canal: Canal = 'whatsapp'): Promise<ContagemTagHoje> {
  const url = `${baseUrl(canal)}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=1000`
  const res = await fetchComRetry429(url, apiKey, signal)
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const total = Number(json.meta?.total ?? 0)

  const hojeKey = hojeBrasilISO()
  let hoje = 0
  let ultimoLeadAt: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const contato of (json.data ?? []) as any[]) {
    const createdAt = String(contato.created_at ?? '')
    if (!createdAt) continue
    if (!ultimoLeadAt || createdAt > ultimoLeadAt) ultimoLeadAt = createdAt
    // Compara pelo dia em Brasília, não pela data crua (UTC) do timestamp da SendPulse —
    // do contrário um lead das 22h de Brasília (já 01h UTC do dia seguinte) fica de fora de "hoje".
    if (dataParaBrasilISO(createdAt) === hojeKey) hoje++
  }

  return { total, hoje, ultimoLeadAt }
}

export interface ContagemTagIntervalo {
  total: number
  ultimoLeadAt: string | null
}

const TAMANHO_PAGINA_GETBYTAG = 1000
// Teto de segurança pra paginação — 30 * 1000 = 30 mil contatos revisados no pior caso (intervalo
// bem antigo numa tag com muito volume desde então). Intervalos recentes (o uso normal) param bem
// antes disso.
const MAX_PAGINAS_GETBYTAG = 30

/**
 * Conta quantos contatos de uma tag entraram dentro de [dataInicio, dataFim] (datas YYYY-MM-DD,
 * fuso de Brasília, inclusive nos dois extremos) — direto na API da SendPulse (getByTag), sem
 * passar pelo LeadHub (função externa que filtrava a data no servidor, mas levava ~60-70s fixos
 * por chamada — muito mais lento que paginar aqui, confirmado ao vivo). A lista vem ordenada do
 * mais recente pro mais antigo (`skip` pagina por 1000, o máximo que a API aceita); paramos assim
 * que uma página inteira já é mais velha que `dataInicio` — não precisa varrer o histórico
 * inteiro da tag pra intervalos recentes, que é o uso normal.
 */
export async function contarPorTagIntervaloSendpulse(
  botId: string,
  tag: string,
  apiKey: string,
  dataInicio: string,
  dataFim: string,
  signal?: AbortSignal,
  canal: Canal = 'whatsapp',
): Promise<ContagemTagIntervalo> {
  let total = 0
  let ultimoLeadAt: string | null = null

  for (let pagina = 0; pagina < MAX_PAGINAS_GETBYTAG; pagina++) {
    const skip = pagina * TAMANHO_PAGINA_GETBYTAG
    const url = `${baseUrl(canal)}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=${TAMANHO_PAGINA_GETBYTAG}&skip=${skip}`
    const res = await fetchComRetry429(url, apiKey, signal)
    if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contatos = (json.data ?? []) as any[]
    if (contatos.length === 0) break

    for (const contato of contatos) {
      const createdAt = String(contato.created_at ?? '')
      if (!createdAt) continue
      if (!ultimoLeadAt || createdAt > ultimoLeadAt) ultimoLeadAt = createdAt
      const dia = dataParaBrasilISO(createdAt)
      if (dia >= dataInicio && dia <= dataFim) total++
    }

    const maisVelhoDaPagina = dataParaBrasilISO(String(contatos[contatos.length - 1].created_at ?? ''))
    if (maisVelhoDaPagina < dataInicio) break // resto é só mais antigo — nenhuma página seguinte vai ter algo no intervalo
    if (contatos.length < TAMANHO_PAGINA_GETBYTAG) break // acabou a lista da tag
  }

  return { total, ultimoLeadAt }
}

/**
 * Mesma paginação/critério de parada de `contarPorTagIntervaloSendpulse`, mas devolve os
 * contact_ids em vez de só contar — usado pra varrer a conversa de cada um (ex: contagem de
 * cliques num botão específico), onde a contagem sozinha não basta.
 */
export interface ContatoNoIntervalo {
  id: string
  tags: string[]
}

export async function buscarContatosPorTagIntervaloSendpulse(
  botId: string,
  tag: string,
  apiKey: string,
  dataInicio: string,
  dataFim: string,
  signal?: AbortSignal,
  canal: Canal = 'whatsapp',
): Promise<ContatoNoIntervalo[]> {
  const contatosNoIntervalo: ContatoNoIntervalo[] = []

  for (let pagina = 0; pagina < MAX_PAGINAS_GETBYTAG; pagina++) {
    const skip = pagina * TAMANHO_PAGINA_GETBYTAG
    const url = `${baseUrl(canal)}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=${TAMANHO_PAGINA_GETBYTAG}&skip=${skip}`
    const res = await fetchComRetry429(url, apiKey, signal)
    if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contatos = (json.data ?? []) as any[]
    if (contatos.length === 0) break

    for (const contato of contatos) {
      const createdAt = String(contato.created_at ?? '')
      if (!createdAt) continue
      const dia = dataParaBrasilISO(createdAt)
      if (dia >= dataInicio && dia <= dataFim) contatosNoIntervalo.push({ id: String(contato.id), tags: contato.tags ?? [] })
    }

    const maisVelhoDaPagina = dataParaBrasilISO(String(contatos[contatos.length - 1].created_at ?? ''))
    if (maisVelhoDaPagina < dataInicio) break
    if (contatos.length < TAMANHO_PAGINA_GETBYTAG) break
  }

  return contatosNoIntervalo
}

export async function enviarMensagem(params: {
  botId: string
  telefone: string
  templateId?: string
  variaveis?: Record<string, string>
  apiKey?: string
}): Promise<{ sucesso: boolean; mensagemId?: string }> {
  const res = await fetch(`${baseUrl('whatsapp')}/send`, {
    method: 'POST',
    headers: getHeaders(params.apiKey ?? apiKeyParaBot(params.botId)),
    body: JSON.stringify({
      bot_id: params.botId,
      phone: params.telefone.replace(/\D/g, ''),
      template_id: params.templateId,
      variables: params.variaveis ?? {},
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Sendpulse send error ${res.status}: ${text}`)
  }
  const json = await res.json()
  return { sucesso: true, mensagemId: json.data?.id }
}

export async function executarFlow(params: {
  botId: string
  contactId: string
  flowId: string
  externalData?: Record<string, unknown>
}): Promise<{ success: boolean; rawBody?: unknown }> {
  const body: Record<string, unknown> = {
    bot_id: params.botId,
    contact_id: params.contactId,
    flow_id: params.flowId,
  }
  if (params.externalData) body.external_data = params.externalData

  const res = await fetch(`${baseUrl('whatsapp')}/flows/run`, {
    method: 'POST',
    headers: getHeaders(apiKeyParaBot(params.botId)),
    body: JSON.stringify(body),
  })
  const rawBody = await res.json().catch(() => null)
  if (!res.ok) {
    const text = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)
    throw new Error(`Sendpulse flow run error ${res.status}: ${text}`)
  }
  return { success: rawBody?.success ?? true, rawBody }
}

function extrairTexto(msg: Record<string, unknown> | undefined): string | undefined {
  if (!msg) return undefined
  if (typeof msg.text === 'string') return msg.text
  const data = msg.data as Record<string, unknown> | undefined
  if (!data) return undefined
  const textObj = data.text as Record<string, unknown> | undefined
  if (textObj && typeof textObj.body === 'string') return textObj.body
  if (typeof data.text === 'string') return data.text
  const inter = data.interactive as Record<string, unknown> | undefined
  if (inter) {
    const btn = inter.button_reply as Record<string, unknown> | undefined
    if (btn && typeof btn.title === 'string') return btn.title
  }
  return undefined
}

export async function enviarMensagemDireta(params: {
  contactId: string
  botId: string
  texto: string
  apiKey?: string
}): Promise<{ ok: boolean; statusCode: number; body: unknown }> {
  const res = await fetch(`${baseUrl('whatsapp')}/contacts/send`, {
    method: 'POST',
    headers: getHeaders(params.apiKey ?? apiKeyParaBot(params.botId)),
    body: JSON.stringify({
      contact_id: params.contactId,
      bot_id: params.botId,
      message: {
        type: 'text',
        text: { body: params.texto },
      },
    }),
  })
  const body = await res.json().catch(() => null)
  return { ok: res.ok, statusCode: res.status, body }
}

export async function obterMensagensChat(params: {
  botId: string
  contactId: string
  limit?: number
}): Promise<{ messages: { id: string; type: string; timestamp: number; text?: string }[] }> {
  const res = await fetch(
    `${baseUrl('whatsapp')}/chats/messages?bot_id=${encodeURIComponent(params.botId)}&contact_id=${encodeURIComponent(params.contactId)}&limit=${params.limit ?? 50}`,
    { headers: getHeaders(apiKeyParaBot(params.botId)) }
  )
  if (!res.ok) return { messages: [] }
  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (json.data ?? []).map((m: any) => ({
    id: m.id ?? '',
    type: m.type ?? '',
    timestamp: m.timestamp ?? 0,
    text: m.text ?? m.data?.text?.body ?? undefined,
  }))
  return { messages }
}

/** Sem bot_id pra resolver a conta de antemão — tenta cada conta configurada em
 * sequência até uma responder com sucesso (só usado em rota de debug). */
export async function obterTelefonePorContactId(contactId: string): Promise<string | null> {
  for (const conta of listarContasSendpulse()) {
    const res = await fetch(`${baseUrl('whatsapp')}/contacts/get?id=${encodeURIComponent(contactId)}`, {
      headers: getHeaders(conta.apiKey),
    })
    if (!res.ok) continue
    const json = await res.json()
    if (!json.success) continue
    const username = json.data?.channel_data?.username
    if (username) return String(username)
  }
  return null
}

export async function listarChatsAtivos(
  botId: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ chats: ChatAtivoSendpulse[]; total: number }> {
  const res = await fetchComRetry429(`${baseUrl('whatsapp')}/chats?bot_id=${encodeURIComponent(botId)}&limit=100`, apiKey, signal)
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const total: number = json.meta?.total ?? 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chats: ChatAtivoSendpulse[] = (json.data ?? []).map((chat: any) => {
    const contact = chat.contact ?? {}
    const channelData = contact.channel_data ?? {}
    return {
      contactId: contact.id ?? '',
      contactNome: channelData.name ?? channelData.first_name ?? '',
      contactTelefone: channelData.username ?? '',
      ultimaMensagem: extrairTexto(chat.inbox_last_message),
      ultimaAtividade: chat.inbox_last_message?.created_at ?? '',
      naoLidas: chat.inbox_unread ?? 0,
      chatAberto: chat.is_chat_opened ?? false,
    }
  })

  return { chats, total }
}
