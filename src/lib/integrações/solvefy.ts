// Solvefy (CPaaS da parceira Cephas) — envio de SMS de verdade, no molde de whapi.ts.
// Docs: https://solvefy.com/api. Rate limit: 100 req/s.

const BASE_URL = process.env.SOLVEFY_BASE_URL || 'https://cpaas-api.solvefy.com'
const API_KEY = process.env.SOLVEFY_API_KEY

function getHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export interface EnviarSmsParams {
  from: string
  to: string
  body: string
  variables?: Record<string, string>
  reference?: string
  useShortener?: boolean
  shortenerSettings?: { trackClicks?: boolean; expiryDays?: number }
  callbackUrl?: string
}

export interface EnviarSmsResultado {
  ok: boolean
  id?: string
  status?: string
  error?: string
}

/** Normaliza telefone pro formato que a Solvefy espera: só dígitos, com DDI, sem "+". Assume
 * Brasil (55) quando o número não já vem com DDI (10-11 dígitos locais → prefixa 55). */
export function normalizarTelefone(valor: string): string {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return digitos
}

export async function enviarSms(params: EnviarSmsParams): Promise<EnviarSmsResultado> {
  if (!API_KEY) return { ok: false, error: 'SOLVEFY_API_KEY não configurado' }

  const res = await fetch(`${BASE_URL}/cpaas/v1/sms/messages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      body: params.body,
      variables: params.variables,
      reference: params.reference,
      useShortener: params.useShortener,
      shortenerSettings: params.shortenerSettings,
      callbackUrl: params.callbackUrl,
      encoding: 'AUTO',
      expiresIn: 86400,
    }),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const errMsg = json?.message || json?.error || JSON.stringify(json).slice(0, 200)
    return { ok: false, error: `HTTP ${res.status}: ${errMsg}` }
  }

  return { ok: true, id: json?.id, status: json?.status }
}

export interface StatusSmsResultado {
  ok: boolean
  status?: string
  error?: string
}

export async function consultarStatusSms(id: string): Promise<StatusSmsResultado> {
  if (!API_KEY) return { ok: false, error: 'SOLVEFY_API_KEY não configurado' }

  const res = await fetch(`${BASE_URL}/cpaas/v1/sms/messages/${id}`, {
    headers: getHeaders(),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const errMsg = json?.message || json?.error || JSON.stringify(json).slice(0, 200)
    return { ok: false, error: `HTTP ${res.status}: ${errMsg}` }
  }

  return { ok: true, status: json?.status }
}

/* ===================== RCS ===================== */
// Mesma CPaaS/base/API key do SMS — só muda o endpoint e o corpo (content estruturado).
// Body de referência: RCS-body-request.md. Endpoint assumido no molde do de SMS; se a Solvefy
// usar outro caminho, é só setar SOLVEFY_RCS_ENDPOINT.

const RCS_ENDPOINT = process.env.SOLVEFY_RCS_ENDPOINT || '/cpaas/v1/rcs/messages'

/** Agent ID do RCS (campo `from`). Marca única — configurado no ambiente. */
export const SOLVEFY_RCS_AGENT_ID = process.env.SOLVEFY_RCS_AGENT_ID || ''

export interface EnviarRcsParams {
  from: string
  to: string
  content: Record<string, unknown>
  reference?: string
  callbackUrl?: string
}

export async function enviarRcs(params: EnviarRcsParams): Promise<EnviarSmsResultado> {
  if (!API_KEY) return { ok: false, error: 'SOLVEFY_API_KEY não configurado' }
  if (!params.from) return { ok: false, error: 'SOLVEFY_RCS_AGENT_ID não configurado' }

  const res = await fetch(`${BASE_URL}${RCS_ENDPOINT}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      content: params.content,
      reference: params.reference,
      callbackUrl: params.callbackUrl,
    }),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const errMsg = json?.message || json?.error || JSON.stringify(json).slice(0, 200)
    return { ok: false, error: `HTTP ${res.status}: ${errMsg}` }
  }

  return { ok: true, id: json?.id, status: json?.status }
}

export async function consultarStatusRcs(id: string): Promise<StatusSmsResultado> {
  if (!API_KEY) return { ok: false, error: 'SOLVEFY_API_KEY não configurado' }

  const res = await fetch(`${BASE_URL}${RCS_ENDPOINT}/${id}`, {
    headers: getHeaders(),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const errMsg = json?.message || json?.error || JSON.stringify(json).slice(0, 200)
    return { ok: false, error: `HTTP ${res.status}: ${errMsg}` }
  }

  return { ok: true, status: json?.status }
}
