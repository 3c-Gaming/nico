export interface EstadoEdicao {
  paginaId: string
  destIndex: number
  novoPhone: string
  novoFlowId: string
  novoFlowNome: string
}

// In-memory state per chat (suficiente para uso operacional)
export const estadosEdicao = new Map<number, EstadoEdicao>()

// Estado para edição de campos textuais (URL, config)
export interface EstadoEdicaoConfig {
  paginaId: string
  paginaIdx: number
  campo: string       // ex: 'redirectUrl', 'baseUrl', 'spreadsheetId'
  valorAtual: string
  originalMessageId?: number
}
export const estadosEdicaoConfig = new Map<number, EstadoEdicaoConfig>()

export interface PaginaCache {
  id: string
  nome: string
  github_owner: string
  github_repo: string
  destinations: Array<{ phone: string; flowId: string; weight: number }>
  text: string
  lovable_project_id?: string
  tipo?: string
  tracking_file?: string
  funil?: string
  casa_id?: string
  tags?: string[]
  lovable_name?: string
}

// Cache de páginas por chatId
export const paginasCache = new Map<number, PaginaCache[]>()

// Cache de casas de aposta por chatId
export interface CasaCache {
  id: string
  nome: string
  cor: string
  slug: string
}
export const casasCache = new Map<number, CasaCache[]>()

/** Garantir que cache de páginas está populado (recarrega do Supabase se vazio) */
export async function ensurePaginasCache(chatId: number): Promise<PaginaCache[]> {
  const cached = paginasCache.get(chatId)
  if (cached && cached.length > 0) return cached

  const { getSupabase } = await import('@/lib/db/supabase')
  const sb = getSupabase()
  if (!sb) return []

  const { data } = await sb.from('paginas').select('*').order('nome')
  const paginas = (data ?? []) as PaginaCache[]
  paginasCache.set(chatId, paginas)
  return paginas
}

/** Garantir que cache de casas está populado */
export async function ensureCasasCache(chatId: number): Promise<CasaCache[]> {
  const cached = casasCache.get(chatId)
  if (cached && cached.length > 0) return cached

  const { getSupabase } = await import('@/lib/db/supabase')
  const sb = getSupabase()
  if (!sb) return []

  const { data } = await sb.from('casas_aposta').select('id, nome, cor, slug').order('nome')
  const casas = (data ?? []) as CasaCache[]
  casasCache.set(chatId, casas)
  return casas
}
