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
}

// Cache de páginas por chatId
export const paginasCache = new Map<number, PaginaCache[]>()
