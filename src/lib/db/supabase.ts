import { createClient } from '@supabase/supabase-js'
import type { Disparo, DisparoPilhado, PilhadoPremiosConfig, Esteira, CasaAposta, LinkTemplate, FlowTagConfig, CacheMetrica, Demanda, UsuarioResponsavel, UtmConfig, EsteiraEtapaConfig, Resultado, FunilComparacao, FunilApresentacao } from '@/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[supabase] SUPABASE_URL ou SUPABASE_KEY não configurados')
}

const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient> | undefined
}

const CAMEL_TO_SNAKE: Record<string, string> = {
  atualizadoEm: 'atualizado_em',
  betmgmPid: 'betmgm_pid',
  botId: 'bot_id',
  casaId: 'casa_id',
  campanhasMeta: 'campanhas_meta',
  casasAposta: 'casas_aposta',
  cpaPainelId: 'cpa_painel_id',
  criadaEm: 'criado_em',
  criadoEm: 'criado_em',
  custoPorEnvio: 'custo_por_envio',
  clientesCaptados: 'clientes_captados',
  daxxCampanhaId: 'daxx_campanha_id',
  dataConclusao: 'data_conclusao',
  dataCriacao: 'data_criacao',
  dataDisparo: 'data_disparo',
  discordId: 'discord_id',
  edicaoId: 'edicao_id',
  edicaoLabel: 'edicao_label',
  esteiraPaiId: 'esteira_pai_id',
  flowId: 'flow_id',
  flowIds: 'flow_ids',
  kpisBotao: 'kpis_botao',
  kpisCusto: 'kpis_custo',
  lpUrl: 'lp_url',
  quantidadeCompras: 'quantidade_compras',
  receitaVendas: 'receita_vendas',
  ticketMedio: 'ticket_medio',
  numeroSendpulse: 'numero_sendpulse',
  offsetDias: 'offset_dias',
  funilIds: 'funil_ids',
  horarioDisparo: 'horario_disparo',
  leadsHoje: 'leads_hoje',
  linkTemplatesSelecionados: 'link_templates_selecionados',
  numerosSendpulse: 'numeros_sendpulse',
  paineisCPA: 'paineis_cpa',
  periodoInicio: 'periodo_inicio',
  periodoFim: 'periodo_fim',
  pinnedFunis: 'pinned_funis',
  pinnedNumeros: 'pinned_numeros',
  pinnedDisparos: 'pinned_disparos',
  publicToken: 'public_token',
  responsavelId: 'responsavel_id',
  siteId: 'site_id',
  utmsExtras: 'utms_extras',
  templateDaxx: 'template_daxx',
  totalBase: 'total_base',
  totalLeads: 'total_leads',
  updatedAt: 'updated_at',
  urlTemplate: 'url_template',
  userStories: 'user_stories',
  valorTotalBase: 'valor_total_base',
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

const SNAKE_TO_CAMEL: Record<string, string> = {
  responsavel_id: 'responsavelId',
  data_criacao: 'dataCriacao',
  data_conclusao: 'dataConclusao',
  user_stories: 'userStories',
  funil_ids: 'funilIds',
  numeros_sendpulse: 'numerosSendpulse',
  discord_id: 'discordId',
  criado_em: 'criadoEm',
  atualizado_em: 'atualizadoEm',
  custo_por_envio: 'custoPorEnvio',
  daxx_campanha_id: 'daxxCampanhaId',
  casa_id: 'casaId',
  url_template: 'urlTemplate',
  flow_id: 'flowId',
  flow_ids: 'flowIds',
  kpis_botao: 'kpisBotao',
  kpis_custo: 'kpisCusto',
  lp_url: 'lpUrl',
  numero_sendpulse: 'numeroSendpulse',
  offset_dias: 'offsetDias',
  bot_id: 'botId',
  pinned_numeros: 'pinnedNumeros',
  pinned_funis: 'pinnedFunis',
  pinned_disparos: 'pinnedDisparos',
  updated_at: 'updatedAt',
  esteira_pai_id: 'esteiraPaiId',
  template_daxx: 'templateDaxx',
  data_disparo: 'dataDisparo',
  horario_disparo: 'horarioDisparo',
  casas_aposta: 'casasAposta',
  campanhas_meta: 'campanhasMeta',
  link_templates_selecionados: 'linkTemplatesSelecionados',
  cpa_painel_id: 'cpaPainelId',
  betmgm_pid: 'betmgmPid',
  valor_total_base: 'valorTotalBase',
  total_base: 'totalBase',
  paineis_cpa: 'paineisCPA',
  leads_hoje: 'leadsHoje',
  total_leads: 'totalLeads',
  periodo_inicio: 'periodoInicio',
  periodo_fim: 'periodoFim',
  public_token: 'publicToken',
  site_id: 'siteId',
  utms_extras: 'utmsExtras',
  clientes_captados: 'clientesCaptados',
  edicao_id: 'edicaoId',
  edicao_label: 'edicaoLabel',
  quantidade_compras: 'quantidadeCompras',
  receita_vendas: 'receitaVendas',
  ticket_medio: 'ticketMedio',
}

function fromSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = SNAKE_TO_CAMEL[k] ?? k
    result[key] = v
  }
  return result
}

function rows<T>(data: unknown): T[] {
  const arr = (data ?? []) as Record<string, unknown>[]
  return arr.map((item) => fromSnakeCase(item)) as T[]
}

function row<T>(data: unknown): T | null {
  if (!data) return null
  return fromSnakeCase(data as Record<string, unknown>) as T
}

function tb(name: string) {
  if (!getSupabase()) throw new Error('Supabase não disponível')
  return getSupabase()!.from(name) as any
}

// --- Preferências (pins) ---

export async function getPreferencias(): Promise<{ pinnedNumeros: string[]; pinnedFunis: string[]; pinnedDisparos: string[]; numerosNaoMonitorados: string[]; contaNomes: Record<string, string> }> {
  try {
    const { data } = await tb('user_preferences').select('*').eq('id', 'global').single()
    const raw = data as any
    const parse = (v: unknown): string[] => {
      if (Array.isArray(v)) return v
      if (typeof v === 'string') try { return JSON.parse(v) } catch { return [] }
      return []
    }
    const parseObj = (v: unknown): Record<string, string> => {
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string>
      if (typeof v === 'string') try { return JSON.parse(v) } catch { return {} }
      return {}
    }
    return {
      pinnedNumeros: parse(raw?.pinned_numeros),
      pinnedFunis: parse(raw?.pinned_funis),
      pinnedDisparos: parse(raw?.pinned_disparos),
      numerosNaoMonitorados: parse(raw?.numeros_nao_monitorados),
      contaNomes: parseObj(raw?.conta_nomes),
    }
  } catch {
    return { pinnedNumeros: [], pinnedFunis: [], pinnedDisparos: [], numerosNaoMonitorados: [], contaNomes: {} }
  }
}

/** Nome amigável que o usuário deu a uma conta SendPulse (ver tela de Configurações) —
 * sobrepõe o `nome`/`SENDPULSE_NN_NOME` do .env, que sem isso cai no fallback genérico
 * "Conta 01"/"Conta 02" quando ninguém preencheu essa env var. */
export async function atualizarNomeConta(contaId: string, nome: string): Promise<Record<string, string>> {
  const { contaNomes } = await getPreferencias()
  const atualizado = { ...contaNomes, [contaId]: nome }
  // Verifica o erro explicitamente (em vez de só `await`) — o client do Supabase não lança
  // exceção sozinho quando o upsert falha (ex: coluna conta_nomes ainda não migrada), então sem
  // isso o chamador acha que salvou quando na verdade não persistiu nada.
  const { error } = await tb('user_preferences').upsert({
    id: 'global',
    conta_nomes: atualizado,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  return atualizado
}

export async function updatePreferencias(pinnedNumeros: string[], pinnedFunis: string[], numerosNaoMonitorados: string[], pinnedDisparos: string[]): Promise<void> {
  await tb('user_preferences')
    .upsert({
      id: 'global',
      pinned_numeros: pinnedNumeros,
      pinned_funis: pinnedFunis,
      pinned_disparos: pinnedDisparos,
      numeros_nao_monitorados: numerosNaoMonitorados,
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
  const { data, error } = await tb('disparos').insert(toSnakeCase(disparo as any)).select().single()
  if (error) {
    if (error.code === '23505') throw new Error(`DUPLICATE_DAXX_CAMPANHA:${disparo.daxxCampanhaId ?? ''}`)
    throw new Error(`Erro ao criar disparo: ${error.message}`)
  }
  return row<Disparo>(data)!
}

export async function getDisparoPorDaxxCampanhaId(daxxCampanhaId: string): Promise<Disparo | null> {
  const { data } = await tb('disparos').select('*').eq('daxx_campanha_id', daxxCampanhaId).maybeSingle()
  return row<Disparo>(data)
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

// --- Disparos Pilhado (braço "Pilhado Prêmios") ---

export async function listarDisparosPilhado(): Promise<DisparoPilhado[]> {
  const { data } = await tb('disparos_pilhado').select('*').order('data', { ascending: false })
  return rows<DisparoPilhado>(data)
}

export async function getDisparoPilhado(id: string): Promise<DisparoPilhado | null> {
  const { data } = await tb('disparos_pilhado').select('*').eq('id', id).single()
  return row<DisparoPilhado>(data)
}

export async function getDisparoPilhadoPorDaxxCampanhaId(daxxCampanhaId: string): Promise<DisparoPilhado | null> {
  const { data } = await tb('disparos_pilhado').select('*').eq('daxx_campanha_id', daxxCampanhaId).maybeSingle()
  return row<DisparoPilhado>(data)
}

export async function criarDisparoPilhado(disparo: DisparoPilhado): Promise<DisparoPilhado> {
  const { data, error } = await tb('disparos_pilhado').insert(toSnakeCase(disparo as any)).select().single()
  if (error) {
    if (error.code === '23505') throw new Error(`DUPLICATE_DAXX_CAMPANHA:${disparo.daxxCampanhaId ?? ''}`)
    throw new Error(`Erro ao criar disparo pilhado: ${error.message}`)
  }
  return row<DisparoPilhado>(data)!
}

export async function atualizarDisparoPilhado(id: string, updates: Partial<DisparoPilhado>): Promise<DisparoPilhado | null> {
  const { data } = await tb('disparos_pilhado')
    .update(toSnakeCase({ ...updates, atualizadoEm: new Date().toISOString() } as any))
    .eq('id', id)
    .select()
    .single()
  return row<DisparoPilhado>(data)
}

export async function deletarDisparoPilhado(id: string): Promise<boolean> {
  const { error } = await tb('disparos_pilhado').delete().eq('id', id)
  return !error
}

export async function bulkInsertDisparosPilhado(disparos: DisparoPilhado[]): Promise<DisparoPilhado[]> {
  const { data } = await tb('disparos_pilhado').insert(disparos.map((d) => toSnakeCase(d as any))).select()
  return rows<DisparoPilhado>(data)
}

// --- Pilhado Prêmios: config de vendas por painel (edição escolhida manualmente) ---

export async function listarConfigsPilhadoPremios(): Promise<PilhadoPremiosConfig[]> {
  const { data } = await tb('pilhado_premios_config').select('*')
  return rows<PilhadoPremiosConfig>(data)
}

export async function getConfigPilhadoPremios(painel: string): Promise<PilhadoPremiosConfig | null> {
  const { data } = await tb('pilhado_premios_config').select('*').eq('painel', painel).maybeSingle()
  return row<PilhadoPremiosConfig>(data)
}

export async function upsertConfigPilhadoPremios(config: PilhadoPremiosConfig): Promise<PilhadoPremiosConfig> {
  const { data, error } = await tb('pilhado_premios_config')
    .upsert(toSnakeCase(config as any))
    .select()
    .single()
  if (error) throw new Error(`Erro ao salvar config pilhado premios: ${error.message}`)
  return row<PilhadoPremiosConfig>(data)!
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
  const { data, error } = await tb('esteiras').insert(toSnakeCase(esteira as any)).select().single()
  if (error) throw new Error(`Erro ao criar esteira: ${error.message}`)
  return row<Esteira>(data)!
}

export async function upsertEtapaDaxx(params: {
  esteiraId: string
  chave: string
  nome: string
  casas: string[]
  etapa: { tipo: string; disparoId: string }
  disparoId: string
}): Promise<Esteira> {
  const sb = getSupabase() as any
  if (!sb) throw new Error('Supabase não disponível')
  const { data, error } = await sb.rpc('fn_cadastrar_etapa_daxx', {
    p_esteira_id: params.esteiraId,
    p_chave: params.chave,
    p_nome: params.nome,
    p_casas: params.casas,
    p_etapa: params.etapa,
    p_disparo_id: params.disparoId,
  })
  if (error) throw new Error(`Erro ao upsert etapa: ${error.message}`)
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

// --- Demandas ---

export async function listarDemandas(): Promise<Demanda[]> {
  const { data, error } = await tb('demandas').select('*').order('ordem', { ascending: true })
  if (error) {
    console.warn('[supabase] listarDemandas error:', error.message)
    return []
  }
  return rows<Demanda>(data)
}

export async function getDemanda(id: string): Promise<Demanda | null> {
  const { data, error } = await tb('demandas').select('*').eq('id', id).single()
  if (error) return null
  return row<Demanda>(data)
}

export async function criarDemanda(demanda: Demanda): Promise<Demanda> {
  const { data, error } = await tb('demandas').insert(toSnakeCase(demanda as any)).select().single()
  if (error) throw new Error(`Erro ao criar demanda: ${error.message}`)
  return row<Demanda>(data)!
}

export async function atualizarDemanda(id: string, updates: Partial<Demanda>): Promise<Demanda | null> {
  const { data, error } = await tb('demandas')
    .update(toSnakeCase({ ...updates, atualizadoEm: new Date().toISOString() } as any))
    .eq('id', id)
    .select()
    .single()
  if (error) return null
  return row<Demanda>(data)
}

export async function deletarDemanda(id: string): Promise<boolean> {
  const { error } = await tb('demandas').delete().eq('id', id)
  return !error
}

// --- Resultados ---

export async function listarResultados(): Promise<Resultado[]> {
  const { data, error } = await tb('resultados').select('*').order('criado_em', { ascending: false })
  if (error) {
    console.warn('[supabase] listarResultados error:', error.message)
    return []
  }
  return rows<Resultado>(data)
}

export async function getResultado(id: string): Promise<Resultado | null> {
  const { data, error } = await tb('resultados').select('*').eq('id', id).single()
  if (error) return null
  return row<Resultado>(data)
}

export async function getResultadoPorToken(token: string): Promise<Resultado | null> {
  const { data, error } = await tb('resultados').select('*').eq('public_token', token).single()
  if (error) return null
  return row<Resultado>(data)
}

export async function criarResultado(resultado: Resultado): Promise<Resultado> {
  const { data, error } = await tb('resultados').insert(toSnakeCase(resultado as any)).select().single()
  if (error) throw new Error(`Erro ao criar resultado: ${error.message}`)
  return row<Resultado>(data)!
}

export async function atualizarResultado(id: string, updates: Partial<Resultado>): Promise<Resultado | null> {
  const { data, error } = await tb('resultados')
    .update(toSnakeCase({ ...updates, atualizadoEm: new Date().toISOString() } as any))
    .eq('id', id)
    .select()
    .single()
  if (error) return null
  return row<Resultado>(data)
}

export async function deletarResultado(id: string): Promise<boolean> {
  const { error } = await tb('resultados').delete().eq('id', id)
  return !error
}

// --- Funis Comparações ---

export async function listarFunisComparacoes(): Promise<FunilComparacao[]> {
  const { data, error } = await tb('funis_comparacoes').select('*').order('criado_em', { ascending: false }).limit(50)
  if (error) {
    console.warn('[supabase] listarFunisComparacoes error:', error.message)
    return []
  }
  return rows<FunilComparacao>(data)
}

export async function criarFunilComparacao(comparacao: FunilComparacao): Promise<FunilComparacao> {
  const { data, error } = await tb('funis_comparacoes').insert(toSnakeCase(comparacao as any)).select().single()
  if (error) throw new Error(`Erro ao criar comparação: ${error.message}`)
  return row<FunilComparacao>(data)!
}

export async function atualizarFunilComparacao(id: string, titulo: string): Promise<FunilComparacao | null> {
  const { data, error } = await tb('funis_comparacoes').update({ titulo }).eq('id', id).select().single()
  if (error) return null
  return row<FunilComparacao>(data)
}

export async function deletarFunilComparacao(id: string): Promise<boolean> {
  const { error } = await tb('funis_comparacoes').delete().eq('id', id)
  return !error
}

// --- Funis Apresentações (funil único) ---

export async function criarFunilApresentacao(apresentacao: FunilApresentacao): Promise<FunilApresentacao> {
  const { data, error } = await tb('funis_apresentacoes').insert(toSnakeCase(apresentacao as any)).select().single()
  if (error) throw new Error(`Erro ao criar apresentação: ${error.message}`)
  return row<FunilApresentacao>(data)!
}

export async function buscarFunilApresentacao(id: string): Promise<FunilApresentacao | null> {
  const { data, error } = await tb('funis_apresentacoes').select('*').eq('id', id).maybeSingle()
  if (error) return null
  return row<FunilApresentacao>(data)
}

export async function atualizarComentariosFunilApresentacao(id: string, comentarios: string): Promise<FunilApresentacao | null> {
  const { data, error } = await tb('funis_apresentacoes')
    .update({ comentarios, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return null
  return row<FunilApresentacao>(data)
}

// --- Usuarios Responsaveis ---

export async function listarUsuariosResponsaveis(): Promise<UsuarioResponsavel[]> {
  const { data, error } = await tb('usuarios_responsaveis').select('*').order('nome')
  if (error) {
    console.warn('[supabase] listarUsuariosResponsaveis error:', error.message)
    return []
  }
  return rows<UsuarioResponsavel>(data)
}

export async function criarUsuarioResponsavel(usuario: UsuarioResponsavel): Promise<UsuarioResponsavel> {
  const { data, error } = await tb('usuarios_responsaveis').insert(toSnakeCase(usuario as any)).select().single()
  if (error) throw new Error(`Erro ao criar usuario: ${error.message}`)
  return row<UsuarioResponsavel>(data)!
}

export async function deletarUsuarioResponsavel(id: string): Promise<boolean> {
  const { error } = await tb('usuarios_responsaveis').delete().eq('id', id)
  return !error
}

// --- Utm Configs ---

export async function listarUtmConfigs(): Promise<UtmConfig[]> {
  const { data, error } = await tb('utm_configs').select('*').order('nome')
  if (error) {
    console.warn('[supabase] listarUtmConfigs error:', error.message)
    return []
  }
  return rows<UtmConfig>(data)
}

export async function criarUtmConfig(config: UtmConfig): Promise<UtmConfig> {
  const { data, error } = await tb('utm_configs').insert(toSnakeCase(config as any)).select().single()
  if (error) throw new Error(`Erro ao criar utm config: ${error.message}`)
  return row<UtmConfig>(data)!
}

export async function atualizarUtmConfig(id: string, updates: Partial<UtmConfig>): Promise<UtmConfig | null> {
  const { data, error } = await tb('utm_configs')
    .update(toSnakeCase(updates as any))
    .eq('id', id)
    .select()
    .single()
  if (error) return null
  return row<UtmConfig>(data)
}

export async function deletarUtmConfig(id: string): Promise<boolean> {
  const { error } = await tb('utm_configs').delete().eq('id', id)
  return !error
}

// --- Etapa Configs ---

export async function listarEtapaConfigs(): Promise<EsteiraEtapaConfig[]> {
  const { data, error } = await tb('etapa_configs').select('*').order('tipo')
  if (error) {
    console.warn('[supabase] listarEtapaConfigs error:', error.message)
    return []
  }
  return rows<EsteiraEtapaConfig>(data)
}

export async function atualizarEtapaConfigs(configs: EsteiraEtapaConfig[]): Promise<EsteiraEtapaConfig[]> {
  // Replace all: delete existing, insert new
  const { error: delErr } = await tb('etapa_configs').delete().gte('tipo', '')
  if (delErr) throw new Error(`Erro ao limpar etapa configs: ${delErr.message}`)
  const { data, error } = await tb('etapa_configs').insert(configs.map((c) => toSnakeCase(c as any))).select()
  if (error) throw new Error(`Erro ao inserir etapa configs: ${error.message}`)
  return rows<EsteiraEtapaConfig>(data)
}

export async function upsertCacheMetricas(metricas: CacheMetrica[]): Promise<CacheMetrica[]> {
  const { data, error } = await tb('cache_metricas')
    .upsert(metricas.map((m) => toSnakeCase(m as any)))
    .select()
  if (error) throw new Error(`Erro ao upsert cache metricas: ${error.message}`)
  return rows<CacheMetrica>(data)
}
