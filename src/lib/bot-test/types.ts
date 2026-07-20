export type BotTestStatus = 'pendente' | 'ok' | 'sem_resposta' | 'erro' | 'aviso'

export interface BotConfig {
  botId: string
  numero: string
  botNumero: string
  nome: string
}

export interface BotTestResult {
  botId: string
  numero: string
  nome: string
  ultimoTeste: string
  status: BotTestStatus
  duracaoMs: number
  erro?: string
  pendente?: boolean
  preTriggerTimestamp?: string | null
  triggeredAt?: string
  ultimoTesteOkMs?: number
  ultimoTriggerOkMs?: number
  requestBody?: unknown
  responseBody?: unknown
}

export interface BotTestConfig {
  pollIntervalMs: number
  currentBotIndex?: number
}

export interface BotTestDatabase {
  resultados: Record<string, BotTestResult>
  config?: BotTestConfig
}

export const DEFAULT_POLL_INTERVAL_MS = 900_000
