import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

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
// Sem isso, uma barra no final (bem fácil de colar sem querer no dashboard do Render) vira
// URL duplicada ("...app//api/webhooks/...") na hora de montar o fetch abaixo.
const NICO_WEBHOOK_URL = (process.env.NICO_WEBHOOK_URL || '').replace(/\/+$/, '')

// Tabelas do Supabase do Black Sender que a gente espelha, e o nome de evento que cada uma vira
// no nosso webhook (ver estruturar() em src/app/api/webhooks/blacksender/route.ts, no repo
// principal). Ver reconhecimento feito com Claude in Chrome — o painel não tem API própria,
// fala direto com esse projeto Supabase.
const EVENTO_POR_TABELA: Record<string, string> = {
  contacts: 'leads_realtime',
  flow_runs: 'flow_runs_realtime',
  conversations: 'conversas_realtime',
  messages: 'mensagens_realtime',
  flows: 'flows_realtime',
}
const TABELAS_MONITORADAS = Object.keys(EVENTO_POR_TABELA)

let client: SupabaseClient | null = null
let channel: RealtimeChannel | null = null
let reconectando = false

export const status = {
  autenticado: false,
  conectado: false,
  ultimoEvento: null as string | null,
  ultimoErro: null as string | null,
  ultimaReconexaoForcada: null as string | null,
}

// Confirmado em produção (21/09/2026): o canal fica preso em "conectado: true" (nunca dispara
// CHANNEL_ERROR/TIMED_OUT/CLOSED) mas para de entregar postgres_changes de verdade — uma conexão
// zumbi, provavelmente algum proxy/load balancer no caminho até o Supabase derrubando o
// WebSocket sem mandar um close frame decente, então o cliente nunca percebe que morreu. Sem
// jeito de detectar isso de dentro do processo com confiança (o heartbeat interno do
// realtime-js não pegou), a defesa é derrubar e reconectar do zero por tempo, não por erro —
// limita a janela cega a no máximo esse intervalo em vez de ficar surdo pro resto do dia.
const RECONEXAO_FORCADA_INTERVALO_MS = 10 * 60 * 1000

async function encaminhar(evento: string, payload: Record<string, unknown>) {
  if (!NICO_WEBHOOK_URL) {
    console.warn('[blacksender-bridge] NICO_WEBHOOK_URL não configurada, evento descartado:', evento)
    return
  }
  try {
    const res = await fetch(`${NICO_WEBHOOK_URL}/api/webhooks/blacksender?evento=${evento}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[blacksender-bridge] webhook respondeu ${res.status} pro evento ${evento}`)
    } else {
      console.log(`[blacksender-bridge] encaminhado com sucesso: ${evento}`)
    }
    status.ultimoEvento = new Date().toISOString()
  } catch (err) {
    status.ultimoErro = (err as Error).message
    console.error('[blacksender-bridge] falha ao encaminhar pro webhook:', (err as Error).message)
  }
}

async function autenticar(sb: SupabaseClient) {
  const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error || !data.session) {
    throw new Error(`login Black Sender falhou: ${error?.message ?? 'sem sessão'}`)
  }
  status.autenticado = true
  console.log('[blacksender-bridge] autenticado como', data.user?.email)
}

function subscrever(sb: SupabaseClient) {
  channel = sb.channel('blacksender-bridge-sync')

  for (const tabela of TABELAS_MONITORADAS) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tabela },
      (payload) => {
        const evento = EVENTO_POR_TABELA[tabela]
        console.log(`[blacksender-bridge] evento recebido do Realtime: ${tabela} ${payload.eventType} id=${(payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id}`)
        void encaminhar(evento, {
          tabela,
          operacao: payload.eventType,
          registro: payload.new,
          registroAnterior: payload.old,
        })
      },
    )
  }

  channel.subscribe((statusCanal, err) => {
    console.log('[blacksender-bridge] canal realtime:', statusCanal)
    status.conectado = statusCanal === 'SUBSCRIBED'
    if (err) status.ultimoErro = err.message
    if (statusCanal === 'CHANNEL_ERROR' || statusCanal === 'TIMED_OUT' || statusCanal === 'CLOSED') {
      agendarReconexao(sb)
    }
  })
}

function agendarReconexao(sb: SupabaseClient) {
  if (reconectando) return
  reconectando = true
  status.conectado = false
  console.warn('[blacksender-bridge] canal caiu, reconectando em 10s')
  setTimeout(() => {
    reconectando = false
    channel?.unsubscribe()
    subscrever(sb)
  }, 10_000)
}

function agendarReconexaoForcada(sb: SupabaseClient) {
  setInterval(() => {
    console.log('[blacksender-bridge] reconexão forçada por tempo (proteção contra conexão zumbi)')
    status.ultimaReconexaoForcada = new Date().toISOString()
    channel?.unsubscribe()
    subscrever(sb)
  }, RECONEXAO_FORCADA_INTERVALO_MS)
}

export async function iniciar() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !EMAIL || !PASSWORD) {
    throw new Error('BLACKSENDER_SUPABASE_URL, BLACKSENDER_SUPABASE_ANON_KEY, BLACKSENDER_EMAIL e BLACKSENDER_PASSWORD são obrigatórios')
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: true },
  })

  await autenticar(client)
  subscrever(client)
  agendarReconexaoForcada(client)
}

export async function parar() {
  await channel?.unsubscribe()
  await client?.auth.signOut()
}
