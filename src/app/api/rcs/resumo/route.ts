import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

export interface ResumoCampanhaRcs {
  total: number
  enviados: number
  entregues: number
  lidas: number
  clicados: number
  falhas: number
  /** Nº de números que caíram pro SMS de fallback (fallback_status preenchido). */
  fallbackEnviados: number
  // buckets mutuamente exclusivos (somam `total`) — "o que chegou no lead":
  recebeuRcs: number
  recebeuSms: number
  naoRecebeu: number
  processando: number
}

const STATUS_FALHA = new Set(['erro', 'failed', 'undelivered', 'dropped'])
const STATUS_ENTREGUE = new Set(['delivered', 'read', 'clicked'])
const STATUS_LIDA = new Set(['read', 'clicked'])
const FB_ENTREGUE = new Set(['delivered', 'read'])
const FB_FALHA = new Set(['failed', 'undelivered', 'erro'])
const TAMANHO_PAGINA = 1000
// Curto — os webhooks da Solvefy atualizam os envios a todo momento e a listagem de Disparos
// re-busca em intervalo; não faz sentido segurar o resumo mais que isso.
const CACHE_TTL_MS = 4_000

interface EnvioResumo { campanha: string | null; status: string; clicado: boolean | null; fallback_status: string | null }
interface LinhaResumoSql {
  campanha: string; total: number; enviados: number; entregues: number; lidas: number; clicados: number
  falhas: number; fallback_enviados: number
  recebeu_rcs?: number; recebeu_sms?: number; nao_recebeu?: number; processando?: number
}

let cache: { resumo: Record<string, ResumoCampanhaRcs>; expiraEm: number } | null = null

function vazio(): ResumoCampanhaRcs {
  return {
    total: 0, enviados: 0, entregues: 0, lidas: 0, clicados: 0, falhas: 0, fallbackEnviados: 0,
    recebeuRcs: 0, recebeuSms: 0, naoRecebeu: 0, processando: 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarViaRpc(supabase: any): Promise<Record<string, ResumoCampanhaRcs> | null> {
  const { data, error } = await supabase.rpc('rcs_resumo_por_campanha')
  if (error) return null
  const resumo: Record<string, ResumoCampanhaRcs> = {}
  for (const r of (data ?? []) as LinhaResumoSql[]) {
    resumo[r.campanha] = {
      total: r.total, enviados: r.enviados, entregues: r.entregues,
      lidas: r.lidas ?? 0, clicados: r.clicados ?? 0, falhas: r.falhas,
      fallbackEnviados: r.fallback_enviados ?? 0,
      recebeuRcs: r.recebeu_rcs ?? r.entregues ?? 0,
      recebeuSms: r.recebeu_sms ?? 0,
      naoRecebeu: r.nao_recebeu ?? 0,
      processando: r.processando ?? 0,
    }
  }
  return resumo
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarViaPaginacao(supabase: any): Promise<Record<string, ResumoCampanhaRcs>> {
  const todos: EnvioResumo[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from('rcs_envios')
      .select('campanha, status, clicado, fallback_status')
      .order('enviado_em', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + TAMANHO_PAGINA - 1)
    if (error) throw new Error(error.message)
    todos.push(...(data ?? []))
    if (!data || data.length < TAMANHO_PAGINA) break
    offset += TAMANHO_PAGINA
  }

  const resumo: Record<string, ResumoCampanhaRcs> = {}
  for (const envio of todos) {
    const campanha = envio.campanha
    if (!campanha) continue
    if (!resumo[campanha]) resumo[campanha] = vazio()
    const r = resumo[campanha]
    r.total++
    // enviados = submetido à Solvefy (tudo que saiu de 'queued'); é o que a Solvefy cobra
    if (envio.status !== 'queued') r.enviados++
    if (STATUS_FALHA.has(envio.status)) r.falhas++
    if (STATUS_ENTREGUE.has(envio.status)) r.entregues++
    if (STATUS_LIDA.has(envio.status)) r.lidas++
    if (envio.clicado || envio.status === 'clicked') r.clicados++
    if (envio.fallback_status) r.fallbackEnviados++

    // bucket "o que chegou no lead" (mutuamente exclusivo)
    const fb = envio.fallback_status
    if (STATUS_ENTREGUE.has(envio.status)) r.recebeuRcs++
    else if (fb && FB_ENTREGUE.has(fb)) r.recebeuSms++
    else if (STATUS_FALHA.has(envio.status) && (!fb || FB_FALHA.has(fb))) r.naoRecebeu++
    else r.processando++
  }
  return resumo
}

/** GET /api/rcs/resumo — enviados/entregues/lidas/cliques/falhas por campanha, pra listagem de Disparos. */
export async function GET() {
  if (cache && cache.expiraEm > Date.now()) {
    return NextResponse.json({ resumo: cache.resumo })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ resumo: {} })

  let resumo: Record<string, ResumoCampanhaRcs> | null
  try {
    resumo = await buscarViaRpc(supabase)
    if (!resumo) resumo = await buscarViaPaginacao(supabase)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  cache = { resumo, expiraEm: Date.now() + CACHE_TTL_MS }
  return NextResponse.json({ resumo })
}
