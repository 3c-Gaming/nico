export interface SendRequest {
  to: string
  text: string
}

export interface SendResponse {
  success: boolean
  messageId?: string
  error?: string
}

export interface StatusResponse {
  connected: boolean
  number?: string
  qrNeeded: boolean
  lastDisconnectReason?: string
}

export interface ConfigureWebhookRequest {
  url: string
  secret?: string
}

export interface WebhookPayload {
  from: string
  text: string
  timestamp: number
  messageId: string
}

export interface QrCodes {
  count: number
  pairingCode?: string
}
