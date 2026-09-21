import { createClient } from '@supabase/supabase-js'
import type { Disparo, DisparoPilhado, PilhadoPremiosConfig, Esteira, CasaAposta, LinkTemplate, FlowTagConfig, FunilMetricaDiaria, CacheMetrica, Demanda, UsuarioResponsavel, UtmConfig, EsteiraEtapaConfig, Resultado, FunilComparacao, FunilApresentacao, CampanhaSendpulseImportada, WebhookEventoRecebido, BlacksenderLead, BlacksenderFlowRun, BlacksenderConversa, BlacksenderMensagem, BlacksenderFlow, BlacksenderCanal } from '@/types'
import { inicioDoDiaBrasilMs } from '@/lib/datas'

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
  smsCorpo: 'sms_corpo',
  smsFrom: 'sms_from',
  smsUseShortener: 'sms_use_shortener',
  smsDestinatarios: 'sms_destinatarios',
  telegramBotUsername: 'telegram_bot_username',
  telegramCorpo: 'telegram_corpo',
  telegramDestinatarios: 'telegram_destinatarios',
  rcsTemplateId: 'rcs_template_id',
  rcsConteudo: 'rcs_conteudo',
  rcsFallback: 'rcs_fallback',
  rcsDestinatarios: 'rcs_destinatarios',
  clientesCaptados: 'clientes_captados',
  daxxCampanhaId: 'daxx_campanha_id',
  sendpulseCampanhaId: 'sendpulse_campanha_id',
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
  lucroFtdPorCasa: 'lucro_ftd_por_casa',
  linkRegistro: 'link_registro',
  linkAposta: 'link_aposta',
  ftdsPorCasa: 'ftds_por_casa',
  tagsContagem: 'tags_contagem',
  gastoMeta: 'gasto_meta',
  custoEntrada: 'custo_entrada',
  custoRegistro: 'custo_registro',
  custoFtd: 'custo_ftd',
  lucroFtdTotal: 'lucro_ftd_total',
  contaId: 'conta_id',
  sendAt: 'send_at',
  criadoEmSendpulse: 'criado_em_sendpulse',
  importadoEm: 'importado_em',
  recebidoEm: 'recebido_em',
  etapaId: 'etapa_id',
  aiDisabled: 'ai_disabled',
  criadoEmOrigem: 'criado_em_origem',
  atualizadoEmOrigem: 'atualizado_em_origem',
  contactId: 'contact_id',
  channelId: 'channel_id',
  ultimaMensagemEmOrigem: 'ultima_mensagem_em_origem',
  conversationId: 'conversation_id',
  erroCodigo: 'erro_codigo',
  erroMensagem: 'erro_mensagem',
  midiaUrl: 'midia_url',
  midiaTipo: 'midia_tipo',
  healthStatus: 'health_status',
  healthReason: 'health_reason',
  healthCheckedEm: 'health_checked_em',
  metaPhoneStatus: 'meta_phone_status',
  metaNameStatus: 'meta_name_status',
  qualityRating: 'quality_rating',
  fotoUrl: 'foto_url',
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
  sms_corpo: 'smsCorpo',
  sms_from: 'smsFrom',
  sms_use_shortener: 'smsUseShortener',
  sms_destinatarios: 'smsDestinatarios',
  telegram_bot_username: 'telegramBotUsername',
  telegram_corpo: 'telegramCorpo',
  telegram_destinatarios: 'telegramDestinatarios',
  rcs_template_id: 'rcsTemplateId',
  rcs_conteudo: 'rcsConteudo',
  rcs_fallback: 'rcsFallback',
  rcs_destinatarios: 'rcsDestinatarios',
  daxx_campanha_id: 'daxxCampanhaId',
  sendpulse_campanha_id: 'sendpulseCampanhaId',
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
  lucro_ftd_por_casa: 'lucroFtdPorCasa',
  link_registro: 'linkRegistro',
  link_aposta: 'linkAposta',
  ftds_por_casa: 'ftdsPorCasa',
  tags_contagem: 'tagsContagem',
  gasto_meta: 'gastoMeta',
  custo_entrada: 'custoEntrada',
  custo_registro: 'custoRegistro',
  custo_ftd: 'custoFtd',
  lucro_ftd_total: 'lucroFtdTotal',
  conta_id: 'contaId',
  send_at: 'sendAt',
  criado_em_sendpulse: 'criadoEmSendpulse',
  importado_em: 'importadoEm',
  recebido_em: 'recebidoEm',
  etapa_id: 'etapaId',
  ai_disabled: 'aiDisabled',
  criado_em_origem: 'criadoEmOrigem',
  atualizado_em_origem: 'atualizadoEmOrigem',
  contact_id: 'contactId',
  channel_id: 'channelId',
  ultima_mensagem_em_origem: 'ultimaMensagemEmOrigem',
  conversation_id: 'conversationId',
  erro_codigo: 'erroCodigo',
  erro_mensagem: 'erroMensagem',
  midia_url: 'midiaUrl',
  midia_tipo: 'midiaTipo',
  health_status: 'healthStatus',
  health_reason: 'healthReason',
  health_checked_em: 'healthCheckedEm',
  meta_phone_status: 'metaPhoneStatus',
  meta_name_status: 'metaNameStatus',
  quality_rating: 'qualityRating',
  foto_url: 'fotoUrl',
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

// --- Páginas monitoradas pelo GTmetrix (editáveis na tela de Configurações) ---

/** Lista de URLs que o cron do GTmetrix testa. `configurado: false` = coluna nunca salva
 * (ou Supabase indisponível) — quem chama deve cair no seed de `@/lib/gtmetrix/paginas`. */
export async function getGtmetrixUrls(): Promise<{ urls: string[]; configurado: boolean }> {
  try {
    const { data } = await tb('user_preferences').select('gtmetrix_urls').eq('id', 'global').single()
    const raw = (data as Record<string, unknown> | null)?.gtmetrix_urls
    if (raw == null) return { urls: [], configurado: false }
    const urls = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? (() => { try { return JSON.parse(raw) } catch { return [] } })()
        : []
    return { urls: (urls as string[]).filter((u) => typeof u === 'string'), configurado: true }
  } catch {
    return { urls: [], configurado: false }
  }
}

export async function salvarGtmetrixUrls(urls: string[]): Promise<string[]> {
  const limpo = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)))
  // Checa o erro explicitamente — o client do Supabase não lança sozinho quando o upsert falha
  // (ex: coluna gtmetrix_urls ainda não migrada), e sem isso o chamador acha que salvou.
  const { error } = await tb('user_preferences').upsert({
    id: 'global',
    gtmetrix_urls: limpo,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  return limpo
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
    if (error.code === '23505') {
      // Um insert só pode violar uma dessas duas (nunca as duas juntas — o disparo veio de uma
      // fonte externa ou de outra, nunca das duas), então o campo preenchido no próprio disparo
      // já diz qual constraint foi.
      if (disparo.sendpulseCampanhaId) throw new Error(`DUPLICATE_SENDPULSE_CAMPANHA:${disparo.sendpulseCampanhaId}`)
      throw new Error(`DUPLICATE_DAXX_CAMPANHA:${disparo.daxxCampanhaId ?? ''}`)
    }
    throw new Error(`Erro ao criar disparo: ${error.message}`)
  }
  return row<Disparo>(data)!
}

export async function getDisparoPorDaxxCampanhaId(daxxCampanhaId: string): Promise<Disparo | null> {
  const { data } = await tb('disparos').select('*').eq('daxx_campanha_id', daxxCampanhaId).maybeSingle()
  return row<Disparo>(data)
}

export async function getDisparoPorSendpulseCampanhaId(sendpulseCampanhaId: string): Promise<Disparo | null> {
  const { data } = await tb('disparos').select('*').eq('sendpulse_campanha_id', sendpulseCampanhaId).maybeSingle()
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

// --- Funil Métricas Diárias ---

export async function upsertFunilMetricaDiaria(metrica: FunilMetricaDiaria): Promise<FunilMetricaDiaria> {
  const { data, error } = await tb('funil_metricas_diarias')
    .upsert(toSnakeCase(metrica as any), { onConflict: 'flow_id,data' })
    .select()
    .single()
  if (error) throw new Error(`Erro ao gravar métrica diária do funil: ${error.message}`)
  return row<FunilMetricaDiaria>(data)!
}

export async function listarMetricasDiariasDoFunil(flowId: string, dataInicio: string, dataFim: string): Promise<FunilMetricaDiaria[]> {
  const { data, error } = await tb('funil_metricas_diarias')
    .select('*')
    .eq('flow_id', flowId)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data')
  if (error) {
    console.warn('[supabase] listarMetricasDiariasDoFunil error:', error.message)
    return []
  }
  return rows<FunilMetricaDiaria>(data)
}

// --- Campanhas SendPulse Importadas ---

export async function listarCampanhasSendpulseImportadas(): Promise<CampanhaSendpulseImportada[]> {
  const { data, error } = await tb('campanhas_sendpulse_importadas').select('*').order('criado_em_sendpulse', { ascending: false })
  if (error) {
    console.warn('[supabase] listarCampanhasSendpulseImportadas error:', error.message)
    return []
  }
  return rows<CampanhaSendpulseImportada>(data)
}

export async function buscarCampanhaSendpulseImportada(id: string): Promise<CampanhaSendpulseImportada | null> {
  const { data, error } = await tb('campanhas_sendpulse_importadas').select('*').eq('id', id).single()
  if (error) return null
  return row<CampanhaSendpulseImportada>(data)
}

export async function criarCampanhaSendpulseImportada(campanha: CampanhaSendpulseImportada): Promise<CampanhaSendpulseImportada> {
  const { data, error } = await tb('campanhas_sendpulse_importadas').upsert(toSnakeCase(campanha as any)).select().single()
  if (error) throw new Error(`Erro ao importar campanha: ${error.message}`)
  return row<CampanhaSendpulseImportada>(data)!
}

export async function deletarCampanhaSendpulseImportada(id: string): Promise<boolean> {
  const { error } = await tb('campanhas_sendpulse_importadas').delete().eq('id', id)
  return !error
}

export async function atualizarUtmCampanhaSendpulse(id: string, utm: string | null): Promise<CampanhaSendpulseImportada> {
  const { data, error } = await tb('campanhas_sendpulse_importadas')
    .update({ utm })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`Erro ao atualizar UTM da campanha: ${error.message}`)
  return row<CampanhaSendpulseImportada>(data)!
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

// --- Webhook Eventos Recebidos ---

export async function registrarWebhookEvento(evento: WebhookEventoRecebido): Promise<void> {
  const { error } = await tb('webhook_eventos_recebidos').insert(toSnakeCase(evento as any))
  if (error) console.warn('[supabase] registrarWebhookEvento error:', error.message)
}

export async function listarWebhookEventosRecebidos(origem?: string, limite = 50): Promise<WebhookEventoRecebido[]> {
  let query = tb('webhook_eventos_recebidos').select('*').order('recebido_em', { ascending: false }).limit(limite)
  if (origem) query = query.eq('origem', origem)
  const { data, error } = await query
  if (error) {
    console.warn('[supabase] listarWebhookEventosRecebidos error:', error.message)
    return []
  }
  return rows<WebhookEventoRecebido>(data)
}

// --- Black Sender (leads + flow_runs, via blacksender-bridge em tempo real) ---

export async function upsertBlacksenderLead(lead: BlacksenderLead): Promise<void> {
  const { error } = await tb('blacksender_leads').upsert(toSnakeCase(lead as any))
  if (error) console.warn('[supabase] upsertBlacksenderLead error:', error.message)
}

export async function listarBlacksenderLeadsHoje(): Promise<BlacksenderLead[]> {
  const inicioHoje = new Date(inicioDoDiaBrasilMs()).toISOString()
  const { data, error } = await tb('blacksender_leads')
    .select('*')
    .gte('criado_em_origem', inicioHoje)
    .order('criado_em_origem', { ascending: false })
  if (error) {
    console.warn('[supabase] listarBlacksenderLeadsHoje error:', error.message)
    return []
  }
  return rows<BlacksenderLead>(data)
}

export async function upsertBlacksenderFlowRun(flowRun: BlacksenderFlowRun): Promise<void> {
  const { error } = await tb('blacksender_flow_runs').upsert(toSnakeCase(flowRun as any))
  if (error) console.warn('[supabase] upsertBlacksenderFlowRun error:', error.message)
}

export async function listarBlacksenderFlowRuns(flowId: string): Promise<BlacksenderFlowRun[]> {
  const { data, error } = await tb('blacksender_flow_runs')
    .select('*')
    .eq('flow_id', flowId)
    .order('criado_em_origem', { ascending: false })
  if (error) {
    console.warn('[supabase] listarBlacksenderFlowRuns error:', error.message)
    return []
  }
  return rows<BlacksenderFlowRun>(data)
}

export async function getBlacksenderLead(id: string): Promise<BlacksenderLead | null> {
  const { data, error } = await tb('blacksender_leads').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.warn('[supabase] getBlacksenderLead error:', error.message)
    return null
  }
  return row<BlacksenderLead>(data)
}

export async function listarBlacksenderFlowRunsPorContato(contactId: string): Promise<BlacksenderFlowRun[]> {
  const { data, error } = await tb('blacksender_flow_runs')
    .select('*')
    .eq('contact_id', contactId)
    .order('criado_em_origem', { ascending: false })
  if (error) {
    console.warn('[supabase] listarBlacksenderFlowRunsPorContato error:', error.message)
    return []
  }
  return rows<BlacksenderFlowRun>(data)
}

export async function upsertBlacksenderConversa(conversa: BlacksenderConversa): Promise<void> {
  const { error } = await tb('blacksender_conversas').upsert(toSnakeCase(conversa as any))
  if (error) console.warn('[supabase] upsertBlacksenderConversa error:', error.message)
}

export async function listarBlacksenderConversasPorContato(contactId: string): Promise<BlacksenderConversa[]> {
  const { data, error } = await tb('blacksender_conversas')
    .select('*')
    .eq('contact_id', contactId)
    .order('criado_em_origem', { ascending: false })
  if (error) {
    console.warn('[supabase] listarBlacksenderConversasPorContato error:', error.message)
    return []
  }
  return rows<BlacksenderConversa>(data)
}

export async function upsertBlacksenderMensagem(mensagem: BlacksenderMensagem): Promise<void> {
  const { error } = await tb('blacksender_mensagens').upsert(toSnakeCase(mensagem as any))
  if (error) console.warn('[supabase] upsertBlacksenderMensagem error:', error.message)
}

export async function listarBlacksenderMensagens(conversationId: string): Promise<BlacksenderMensagem[]> {
  const { data, error } = await tb('blacksender_mensagens')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('criado_em_origem', { ascending: true })
  if (error) {
    console.warn('[supabase] listarBlacksenderMensagens error:', error.message)
    return []
  }
  return rows<BlacksenderMensagem>(data)
}

export async function upsertBlacksenderFlow(flow: BlacksenderFlow): Promise<void> {
  const { error } = await tb('blacksender_flows').upsert(toSnakeCase(flow as any))
  if (error) console.warn('[supabase] upsertBlacksenderFlow error:', error.message)
}

export async function listarBlacksenderFlows(): Promise<BlacksenderFlow[]> {
  const { data, error } = await tb('blacksender_flows').select('*').order('nome', { ascending: true })
  if (error) {
    console.warn('[supabase] listarBlacksenderFlows error:', error.message)
    return []
  }
  return rows<BlacksenderFlow>(data)
}

export async function upsertBlacksenderCanal(canal: BlacksenderCanal): Promise<void> {
  const { error } = await tb('blacksender_canais').upsert(toSnakeCase(canal as any))
  if (error) console.warn('[supabase] upsertBlacksenderCanal error:', error.message)
}

export async function listarBlacksenderCanais(): Promise<BlacksenderCanal[]> {
  const { data, error } = await tb('blacksender_canais').select('*').order('nome', { ascending: true })
  if (error) {
    console.warn('[supabase] listarBlacksenderCanais error:', error.message)
    return []
  }
  return rows<BlacksenderCanal>(data)
}

/** "Leads" de um funil vindo de um fluxo Black Sender, pra um dia específico — quantos contatos
 * distintos que passaram por aquele flowId (em qualquer execução) foram CRIADOS (contacts.created_at)
 * naquele dia, não quantas execuções de fluxo houve (mesmo contato pode reentrar no fluxo mais de
 * uma vez sem ser um lead novo). Mesmo papel que a contagem por tag do SendPulse faz pros funis
 * SendPulse (ver contarLeadsIntervalo em sendpulseLeads.ts) — usado em src/lib/funis.ts. */
export async function contarBlacksenderLeadsPorFlowNoDia(flowIds: string[], data: string): Promise<Record<string, number>> {
  const resultado: Record<string, number> = {}
  if (flowIds.length === 0) return resultado

  const { data: execucoes, error: erroExecucoes } = await tb('blacksender_flow_runs')
    .select('flow_id, contact_id')
    .in('flow_id', flowIds)
  if (erroExecucoes) {
    console.warn('[supabase] contarBlacksenderLeadsPorFlowNoDia (flow_runs) error:', erroExecucoes.message)
    return resultado
  }

  const contatosPorFlow = new Map<string, Set<string>>()
  const todosContatos = new Set<string>()
  for (const row of (execucoes ?? []) as { flow_id: string; contact_id: string }[]) {
    if (!row.contact_id) continue
    if (!contatosPorFlow.has(row.flow_id)) contatosPorFlow.set(row.flow_id, new Set())
    contatosPorFlow.get(row.flow_id)!.add(row.contact_id)
    todosContatos.add(row.contact_id)
  }
  if (todosContatos.size === 0) return resultado

  const inicio = new Date(inicioDoDiaBrasilMs(data)).toISOString()
  const fim = new Date(inicioDoDiaBrasilMs(data) + 24 * 60 * 60 * 1000).toISOString()
  const { data: leadsDoDia, error: erroLeads } = await tb('blacksender_leads')
    .select('id')
    .in('id', [...todosContatos])
    .gte('criado_em_origem', inicio)
    .lt('criado_em_origem', fim)
  if (erroLeads) {
    console.warn('[supabase] contarBlacksenderLeadsPorFlowNoDia (leads) error:', erroLeads.message)
    return resultado
  }

  const leadsValidos = new Set(((leadsDoDia ?? []) as { id: string }[]).map((l) => l.id))
  for (const flowId of flowIds) {
    const contatos = contatosPorFlow.get(flowId)
    if (!contatos) { resultado[flowId] = 0; continue }
    let contagem = 0
    for (const contactId of contatos) if (leadsValidos.has(contactId)) contagem++
    resultado[flowId] = contagem
  }
  return resultado
}
