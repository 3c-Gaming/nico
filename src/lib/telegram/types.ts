export interface EstadoEdicao {
  paginaId: string
  destIndex: number
  novoPhone: string
  novoFlowId: string
}

// In-memory state per chat (suficiente para uso operacional)
export const estadosEdicao = new Map<number, EstadoEdicao>()

export interface PaginaCache {
  id: string
  nome: string
  github_owner: string
  github_repo: string
  destinations: Array<{ phone: string; flowId: string; weight: number }>
  text: string
}

// Cache de páginas por chatId
export const paginasCache = new Map<number, PaginaCache[]>()
