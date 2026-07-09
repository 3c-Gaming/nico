import { createClient } from '@supabase/supabase-js'
import type { Disparo, Esteira, CasaAposta, LinkTemplate, FlowTagConfig, CacheMetrica } from '@/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[supabase] SUPABASE_URL ou SUPABASE_KEY não configurados')
}

const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient> | undefined
}

const CAMEL_TO_SNAKE: Record<string, string> = {
  // Disparos
  casasAposta: 'casas_aposta',
  dataDisparo: 'data_disparo',
  horarioDisparo: 'horario_disparo',
  templateDaxx: 'template_daxx',
  numeroSendpulse: 'numero_sendpulse',
  esteiraPaiId: 'esteira_pai_id',
  numerosSendpulse: 'numeros_sendpulse',
  linkTemplatesSelecionados: 'link_templates_selecionados',
  criadoEm: 'criado_em',
  atualizadoEm: 'atualizado_em',
  flowIds: 'flow_ids',
  cpaPainelId: 'cpa_painel_id',
  betmgmPid: 'betmgm_pid',
  valorTotalBase: 'valor_total_base',
  // Esteiras
  criadaEm: 'criado_em',
  // Casas
  paineisCPA: 'paineis_cpa',
  funilIds: 'funil_ids',
  // Link Templates
  casaId: 'casa_id',
  urlTemplate: 'url_template',
  // Flow Tag Configs
  flowId: 'flow_id',
  botId: 'bot_id',
  // Preferencias
  pinnedNumeros: 'pinned_numeros',
  pinnedFunis: 'pinned_funis',
  updatedAt: 'updated_at',
  // Cache Metricas
  leadsHoje: 'leads_hoje',
  totalLeads: 'total_leads',
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = CAMEL_TO_SNAKE[k] ?? k
    result[key] = v
  }
  return result
}

export function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  if (!globalForSupabase.supabase) {
    globalForSupabase.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    })
  }
  return globalForSupabase.supabase
}

function rows<T>(data: unknown): T[] {
  return (data ?? []) as T[]
}

function row<T>(data: unknown): T | null {
  return data as T | null
}

function tb(name: string) {
  if (!getSupabase()) throw new Error('Supabase não disponível')
  return getSupabase()!.from(name) as any
}

// --- Preferências (pins) ---

export async function getPreferencias(): Promise<{ pinnedNumeros: string[]; pinnedFunis: string[] }> {
  try {
    const { data } = await tb('user_preferences').select('*').eq('id', 'global').single()
    const raw = data as any
    const parse = (v: unknown): string[] => {
      if (Array.isArray(v)) return v
      if (typeof v === 'string') try { return JSON.parse(v) } catch { return [] }
      return []
    }
    return {
      pinnedNumeros: parse(raw?.pinned_numeros),
      pinnedFunis: parse(raw?.pinned_funis),
    }
  } catch {
    return { pinnedNumeros: [], pinnedFunis: [] }
  }
}

export async function updatePreferencias(pinnedNumeros: string[], pinnedFunis: string[]): Promise<void> {
  await tb('user_preferences')
    .upsert({
      id: 'global',
      pinned_numeros: pinnedNumeros,
      pinned_funis: pinnedFunis,
      updated_at: new Date().toISOString(),
    })
}

// --- Disparos ---

export async function listarDisparos(filtros?: {
  casa?: string
  tipo?: string
  status?: string
}): Promise<Disparo[]> {
  let query = tb('disparos').select('*').order('criado_em', { ascending: false })

  if (filtros?.casa) query = query.contains('casas_aposta', [filtros.casa])
  if (filtros?.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros?.status) query = query.eq('status', filtros.status)

  const { data } = await query
  return rows<Disparo>(data)
}

export async function getDisparo(id: string): Promise<Disparo | null> {
  const { data } = await tb('disparos').select('*').eq('id', id).single()
  return row<Disparo>(data)
}

export async function criarDisparo(disparo: Disparo): Promise<Disparo> {
  const { data } = await tb('disparos').insert(toSnakeCase(disparo as any)).select().single()
  return row<Disparo>(data)!
}

export async function atualizarDisparo(id: string, updates: Partial<Disparo>): Promise<Disparo | null> {
  const { data } = await tb('disparos')
    .update(toSnakeCase({ ...updates, atualizadoEm: new Date().toISOString() } as any))
    .eq('id', id)
    .select()
    .single()
  return row<Disparo>(data)
}

export async function deletarDisparo(id: string): Promise<boolean> {
  const { error } = await tb('disparos').delete().eq('id', id)
  return !error
}

export async function bulkInsertDisparos(disparos: Disparo[]): Promise<Disparo[]> {
  const { data } = await tb('disparos').upsert(disparos.map((d) => toSnakeCase(d as any))).select()
  return rows<Disparo>(data)
}

// --- Esteiras ---

export async function listarEsteiras(): Promise<Esteira[]> {
  const { data } = await tb('esteiras').select('*').eq('ativa', true).order('criado_em', { ascending: false })
  return rows<Esteira>(data)
}

export async function getEsteira(id: string): Promise<Esteira | null> {
  const { data } = await tb('esteiras').select('*').eq('id', id).single()
  return row<Esteira>(data)
}

export async function criarEsteira(esteira: Esteira): Promise<Esteira> {
  const { data } = await tb('esteiras').insert(toSnakeCase(esteira as any)).select().single()
  return row<Esteira>(data)!
}

export async function deletarEsteira(id: string): Promise<boolean> {
  const { error } = await tb('esteiras').delete().eq('id', id)
  return !error
}

export async function bulkInsertEsteiras(esteiras: Esteira[]): Promise<Esteira[]> {
  const { data } = await tb('esteiras').upsert(esteiras.map((e) => toSnakeCase(e as any))).select()
  return rows<Esteira>(data)
}

// --- Casas de Aposta ---

export async function listarCasas(): Promise<CasaAposta[]> {
  const { data } = await tb('casas_aposta').select('*').order('nome')
  return rows<CasaAposta>(data)
}

// --- Link Templates ---

export async function listarLinkTemplates(): Promise<LinkTemplate[]> {
  const { data } = await tb('link_templates').select('*').order('nome')
  return rows<LinkTemplate>(data)
}

// --- Flow Tag Configs ---

export async function listarFlowTagConfigs(): Promise<FlowTagConfig[]> {
  const { data, error } = await tb('flow_tag_configs').select('*')
  if (error) {
    console.warn('[supabase] listarFlowTagConfigs error:', error.message)
    return []
  }
  return rows<FlowTagConfig>(data)
}

export async function criarFlowTagConfig(config: FlowTagConfig): Promise<FlowTagConfig> {
  const { data, error } = await tb('flow_tag_configs').insert(toSnakeCase(config as any)).select().single()
  if (error) throw new Error(`Erro ao criar flow tag config: ${error.message}`)
  return row<FlowTagConfig>(data)!
}

export async function bulkInsertFlowTagConfigs(configs: FlowTagConfig[]): Promise<FlowTagConfig[]> {
  const { data, error } = await tb('flow_tag_configs').upsert(configs.map((c) => toSnakeCase(c as any))).select()
  if (error) throw new Error(`Erro ao inserir flow tag configs em lote: ${error.message}`)
  return rows<FlowTagConfig>(data)
}

export async function bulkInsertCasas(casas: CasaAposta[]): Promise<CasaAposta[]> {
  const { data } = await tb('casas_aposta').upsert(casas.map((c) => toSnakeCase(c as any))).select()
  return rows<CasaAposta>(data)
}

export async function bulkInsertLinkTemplates(templates: LinkTemplate[]): Promise<LinkTemplate[]> {
  const { data } = await tb('link_templates').upsert(templates.map((t) => toSnakeCase(t as any))).select()
  return rows<LinkTemplate>(data)
}

// --- Casas CRUD ---

export async function criarCasa(casa: CasaAposta): Promise<CasaAposta> {
  const { data } = await tb('casas_aposta').insert(toSnakeCase(casa as any)).select().single()
  return row<CasaAposta>(data)!
}

export async function atualizarCasa(id: string, updates: Partial<CasaAposta>): Promise<CasaAposta | null> {
  const { data } = await tb('casas_aposta')
    .update(toSnakeCase(updates as any))
    .eq('id', id)
    .select()
    .single()
  return row<CasaAposta>(data)
}

export async function deletarCasa(id: string): Promise<boolean> {
  const { error } = await tb('casas_aposta').delete().eq('id', id)
  return !error
}

// --- Link Templates CRUD ---

export async function criarLinkTemplate(template: LinkTemplate): Promise<LinkTemplate> {
  const { data } = await tb('link_templates').insert(toSnakeCase(template as any)).select().single()
  return row<LinkTemplate>(data)!
}

export async function atualizarLinkTemplate(id: string, updates: Partial<LinkTemplate>): Promise<LinkTemplate | null> {
  const { data } = await tb('link_templates')
    .update(toSnakeCase(updates as any))
    .eq('id', id)
    .select()
    .single()
  return row<LinkTemplate>(data)
}

export async function deletarLinkTemplate(id: string): Promise<boolean> {
  const { error } = await tb('link_templates').delete().eq('id', id)
  return !error
}

// --- Flow Tag Configs CRUD ---

export async function atualizarFlowTagConfig(config: FlowTagConfig): Promise<FlowTagConfig> {
  const { data, error } = await tb('flow_tag_configs')
    .upsert(toSnakeCase(config as any))
    .select()
    .single()
  if (error) throw new Error(`Erro ao atualizar flow tag config: ${error.message}`)
  return row<FlowTagConfig>(data)!
}

export async function deletarFlowTagConfig(flowId: string): Promise<boolean> {
  const { error } = await tb('flow_tag_configs').delete().eq('flow_id', flowId)
  return !error
}

// --- Cache Metricas ---

export async function listarCacheMetricas(): Promise<CacheMetrica[]> {
  const { data, error } = await tb('cache_metricas').select('*')
  if (error) {
    console.warn('[supabase] listarCacheMetricas error:', error.message)
    return []
  }
  return rows<CacheMetrica>(data)
}

export async function upsertCacheMetricas(metricas: CacheMetrica[]): Promise<CacheMetrica[]> {
  const { data, error } = await tb('cache_metricas')
    .upsert(metricas.map((m) => toSnakeCase(m as any)))
    .select()
  if (error) throw new Error(`Erro ao upsert cache metricas: ${error.message}`)
  return rows<CacheMetrica>(data)
}
