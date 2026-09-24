import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const SUPABASE_URL = process.env.BLACKSENDER_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.BLACKSENDER_SUPABASE_ANON_KEY || ''
const EMAIL = process.env.BLACKSENDER_EMAIL || ''
const PASSWORD = process.env.BLACKSENDER_PASSWORD || ''
const NICO_WEBHOOK_URL = (process.env.NICO_WEBHOOK_URL || '').replace(/\/+$/, '')

// Trocado de Realtime (WebSocket) pra polling em 21/09/2026 — confirmado em produção que o
// Realtime nunca entrega postgres_changes quando o processo roda no Render (canal fica
// "SUBSCRIBED" normalmente, autentica direitinho, mas nenhum evento chega; o mesmo código local
// pega evento em menos de 1s, sempre). Sem acesso a ferramentas de rede dentro do container pra
// achar a causa exata (proxy/firewall de saída bloqueando o upgrade do WebSocket?), polling é
// muito mais portável — REST puro, funciona em qualquer host.
const POLL_INTERVALO_MS = 30_000
// Ao subir, reprocessa uma janela recente. O cursor fica em memória, mas não pode começar
// "agora": caso contrário, qualquer mensagem/run criado enquanto o bridge estava fora seria
// perdida definitivamente. Os upserts do webhook são idempotentes, então reenviar essa janela é seguro.
const BACKFILL_INICIAL_DIAS = 7
const CONTATOS_JANELA_DIAS = BACKFILL_INICIAL_DIAS
// `select=*` na tabela de mensagens deixava o poll intermitentemente estourar o timeout da
// consulta (status 57014 visto em produção). Estes são os campos que o webhook e o painel usam;
// `interactive` precisa permanecer para reconhecer os botões oferecidos.
const CAMPOS_MENSAGEM = [
  'id', 'conversation_id', 'content', 'direction', 'sender_name', 'status',
  'delivery_error_code', 'delivery_error_message', 'media_url', 'media_type',
  'interactive', 'created_at',
].join(',')

let client: SupabaseClient | null = null
let token: string | null = null

export const status = {
  autenticado: false,
  ultimoCiclo: null as string | null,
  ultimoErro: null as string | null,
  eventosNoUltimoCiclo: 0,
}

async function encaminhar(evento: string, tabela: string, operacao: 'INSERT' | 'UPDATE', registro: Record<string, unknown>) {
  if (!NICO_WEBHOOK_URL) {
    console.warn('[blacksender-bridge] NICO_WEBHOOK_URL não configurada, evento descartado:', evento)
    return
  }
  try {
    const res = await fetch(`${NICO_WEBHOOK_URL}/api/webhooks/blacksender?evento=${evento}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabela, operacao, registro }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      console.error(`[blacksender-bridge] webhook respondeu ${res.status} pro evento ${evento} (${registro.id})`)
      return
    }
  } catch (err) {
    status.ultimoErro = (err as Error).message
    console.error('[blacksender-bridge] falha ao encaminhar pro webhook:', (err as Error).message)
    return
  }
  status.eventosNoUltimoCiclo++
}

async function autenticar(sb: SupabaseClient) {
  const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error || !data.session) {
    throw new Error(`login Black Sender falhou: ${error?.message ?? 'sem sessão'}`)
  }
  status.autenticado = true
  token = data.session.access_token
  console.log('[blacksender-bridge] autenticado como', data.user?.email)
}

async function rest<T>(caminho: string): Promise<T[]> {
  let ultimaResposta: { status: number; corpo: string } | null = null
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    })
    const corpo = await res.text()
    if (res.ok) return JSON.parse(corpo) as T[]
    ultimaResposta = { status: res.status, corpo }
    if (res.status !== 500 && res.status !== 429) break
    if (tentativa < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** tentativa))
  }
  throw new Error(`Supabase REST ${ultimaResposta?.status ?? 'sem resposta'} em ${caminho}: ${ultimaResposta?.corpo ?? ''}`)
}

// Encaminha uma lista pro webhook com concorrência limitada — sequencial (um await por vez) era
// simples mas deixava o primeiro ciclo (sincronizando o backlog inteiro, ex: ~120 contatos dos
// últimos 7 dias) demorado o bastante pra parecer travado. Não precisa de fila sofisticada, só
// não bater tudo de uma vez (ver mesmo princípio em src/lib/gtmetrix/client.ts no repo principal).
const ENCAMINHAR_CONCORRENCIA = 8

async function encaminharEmLotes<T extends Record<string, unknown>>(
  itens: T[],
  evento: string,
  tabela: string,
  operacaoDe: (item: T) => 'INSERT' | 'UPDATE',
) {
  for (let i = 0; i < itens.length; i += ENCAMINHAR_CONCORRENCIA) {
    const lote = itens.slice(i, i + ENCAMINHAR_CONCORRENCIA)
    await Promise.all(lote.map((item) => encaminhar(evento, tabela, operacaoDe(item), item)))
  }
}

/** Avança o cursor apenas até o timestamp realmente visto. Se a página vier cheia (limite do
 * REST), deixá-lo em `agora` pularia o restante; o próximo ciclo continua a partir do último item. */
function maiorTimestamp(itens: Record<string, unknown>[], campos: string[], fallback: string): string {
  let maior = ''
  for (const item of itens) {
    for (const campo of campos) {
      const valor = item[campo]
      if (typeof valor === 'string' && valor > maior) maior = valor
    }
  }
  return maior || fallback
}

const cursorInicial = new Date(Date.now() - BACKFILL_INICIAL_DIAS * 24 * 60 * 60 * 1000).toISOString()
let ultimoPollFlowRuns = cursorInicial
let ultimoPollConversas = cursorInicial
let ultimoPollMensagens = cursorInicial
let ultimoPollFlows = cursorInicial
// contactId -> assinatura (JSON) do estado observado no ciclo anterior, só pra detectar mudança
const contatosConhecidos = new Map<string, string>()
// canalId -> assinatura, mesmo princípio de contatosConhecidos. O heartbeat periódico
// atualiza ultimo_visto_em; a assinatura evita encaminhar mudanças repetidas a cada ciclo.
const canaisConhecidos = new Map<string, string>()
let ultimoCanalHeartbeat = 0
let timerCiclo: ReturnType<typeof setTimeout> | null = null

async function pollContatos() {
  const desde = new Date(Date.now() - CONTATOS_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString()
  const contatos = await rest<Record<string, unknown>>(
    `contacts?select=*&created_at=gte.${desde}&order=created_at.desc&limit=500`,
  )
  const operacaoPorId = new Map<string, 'INSERT' | 'UPDATE'>()
  const mudaram = contatos.filter((c) => {
    const id = String(c.id)
    const assinatura = JSON.stringify({ tags: c.tags, stage_id: c.stage_id, ai_disabled: c.ai_disabled, name: c.name })
    const eraConhecido = contatosConhecidos.has(id)
    if (contatosConhecidos.get(id) === assinatura) return false
    contatosConhecidos.set(id, assinatura)
    operacaoPorId.set(id, eraConhecido ? 'UPDATE' : 'INSERT')
    return true
  })
  await encaminharEmLotes(mudaram, 'leads_realtime', 'contacts', (c) => operacaoPorId.get(String(c.id))!)
}

async function pollFlowRuns() {
  const cursorAnterior = ultimoPollFlowRuns
  const runs = await rest<Record<string, unknown>>(
    `flow_runs?select=*&updated_at=gt.${cursorAnterior}&order=updated_at.asc&limit=500`,
  )
  await encaminharEmLotes(runs, 'flow_runs_realtime', 'flow_runs', () => 'UPDATE')
  ultimoPollFlowRuns = maiorTimestamp(runs, ['updated_at'], cursorAnterior)
}

async function pollConversas() {
  const cursorAnterior = ultimoPollConversas
  const conversas = await rest<Record<string, unknown>>(
    `conversations?select=*&or=(created_at.gt.${cursorAnterior},last_message_at.gt.${cursorAnterior})&order=created_at.asc&limit=500`,
  )
  await encaminharEmLotes(conversas, 'conversas_realtime', 'conversations', () => 'UPDATE')
  ultimoPollConversas = maiorTimestamp(conversas, ['created_at', 'last_message_at'], cursorAnterior)
}

async function pollMensagens() {
  const cursorAnterior = ultimoPollMensagens
  const mensagens = await rest<Record<string, unknown>>(
    `messages?select=${CAMPOS_MENSAGEM}&created_at=gt.${cursorAnterior}&order=created_at.asc&limit=500`,
  )
  await encaminharEmLotes(mensagens, 'mensagens_realtime', 'messages', () => 'INSERT')
  ultimoPollMensagens = maiorTimestamp(mensagens, ['created_at'], cursorAnterior)
}

async function pollFlows() {
  const cursorAnterior = ultimoPollFlows
  const flows = await rest<Record<string, unknown>>(
    `flows?select=*&updated_at=gt.${cursorAnterior}&order=updated_at.asc&limit=200`,
  )
  await encaminharEmLotes(flows, 'flows_realtime', 'flows', () => 'UPDATE')
  ultimoPollFlows = maiorTimestamp(flows, ['updated_at'], cursorAnterior)
}

// Colunas escolhidas a dedo (NUNCA select=*) — whatsapp_channels guarda access_token e
// meta_app_secret de verdade (credencial viva da API do WhatsApp Business). Esses dois campos
// não podem sair daqui: nem passam pelo webhook, nem ficam gravados em lugar nenhum do nosso
// sistema. Só os campos operacionais (nome, telefone, status, saúde, quality rating) importam
// pra tela de Números.
const CANAIS_COLUNAS = [
  'id', 'workspace_id', 'channel_name', 'business_phone_number', 'provider', 'status',
  'health_status', 'health_reason', 'health_checked_at', 'meta_phone_status',
  'meta_name_status', 'meta_quality_rating', 'profile_picture_url', 'created_at', 'updated_at',
].join(',')
const CANAL_HEARTBEAT_INTERVAL_MS = 120_000

async function pollCanais() {
  const canais = await rest<Record<string, unknown>>(
    `whatsapp_channels?select=${CANAIS_COLUNAS}&order=updated_at.asc&limit=100`,
  )
  const agora = Date.now()
  const heartbeatDue = agora - ultimoCanalHeartbeat >= CANAL_HEARTBEAT_INTERVAL_MS
  const mudaram = canais.filter((c) => {
    const id = String(c.id)
    const assinatura = JSON.stringify(c)
    if (canaisConhecidos.get(id) === assinatura) return false
    canaisConhecidos.set(id, assinatura)
    return true
  })

  if (heartbeatDue) {
    // Heartbeat não é uma mudança de estado: atualiza ultimo_visto_em para provar que o canal
    // ainda existe no bridge, sem criar um evento bruto por canal a cada 30s.
    await encaminharEmLotes(canais, 'canais_heartbeat', 'whatsapp_channels', () => 'UPDATE')
    ultimoCanalHeartbeat = agora
  } else if (mudaram.length > 0) {
    await encaminharEmLotes(mudaram, 'canais_realtime', 'whatsapp_channels', () => 'UPDATE')
  }
}

async function ciclo() {
  status.eventosNoUltimoCiclo = 0
  status.ultimoErro = null
  try {
    await Promise.all([pollContatos(), pollFlowRuns(), pollConversas(), pollMensagens(), pollFlows(), pollCanais()])
    status.ultimoCiclo = new Date().toISOString()
    if (status.eventosNoUltimoCiclo > 0) {
      console.log(`[blacksender-bridge] ciclo concluído, ${status.eventosNoUltimoCiclo} evento(s) encaminhado(s)`)
    }
  } catch (err) {
    status.ultimoErro = (err as Error).message
    console.error('[blacksender-bridge] erro no ciclo de poll:', (err as Error).message)
  }
}

export async function iniciar() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !EMAIL || !PASSWORD) {
    throw new Error('BLACKSENDER_SUPABASE_URL, BLACKSENDER_SUPABASE_ANON_KEY, BLACKSENDER_EMAIL e BLACKSENDER_PASSWORD são obrigatórios')
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: true },
  })

  await autenticar(client)

  // Refaz o login a cada 50min — token de sessão expira em 1h (ver expires_in no retorno do
  // signInWithPassword) e aqui é REST puro com Bearer manual, sem o auto-refresh do supabase-js
  // (esse só cuida de chamadas feitas pelo próprio client, não do fetch cru usado em rest()).
  setInterval(() => { void autenticar(client!) }, 50 * 60 * 1000)

  await ciclo()

  // Agenda o próximo ciclo somente depois do atual terminar. Com retry de timeout, um ciclo
  // pode passar de 30s; setInterval sobreposto acabaria multiplicando queries e piorando o
  // statement timeout que estamos tentando corrigir.
  const agendarProximoCiclo = () => {
    timerCiclo = setTimeout(() => {
      void ciclo().finally(agendarProximoCiclo)
    }, POLL_INTERVALO_MS)
  }
  agendarProximoCiclo()
}

export async function parar() {
  if (timerCiclo) clearTimeout(timerCiclo)
  timerCiclo = null
  await client?.auth.signOut()
}
