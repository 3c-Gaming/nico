export interface DaxxCampaign {
  id: string
  nome: string
  status: string
  responsavel: string
  totalBase: number
  entregues: number
  lidas: number
  rejeitados: number
  dataCriacao: string
  linkTemplate?: string
}

export interface ListCampanhasResponse {
  campanhas: DaxxCampaign[]
}

export interface TemplateResponse {
  link: string
}

export interface ErrorResponse {
  error: string
}

export interface HealthResponse {
  ok: boolean
  uptime: number
}
