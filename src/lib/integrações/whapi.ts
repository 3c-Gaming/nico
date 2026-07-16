const BASE_URL = process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud/'
const API_TOKEN = process.env.WHAPI_API_TOKEN

function getHeaders() {
  return {
    Authorization: `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function enviarMensagemGrupo(params: {
  groupId: string
  texto: string
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!API_TOKEN) {
    return { ok: false, error: 'WHAPI_API_TOKEN não configurado' }
  }

  const res = await fetch(`${BASE_URL}messages/text`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      to: params.groupId,
      body: params.texto,
    }),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok || json?.errors?.length) {
    const errMsg = json?.errors?.[0]?.message || JSON.stringify(json).slice(0, 200)
    return { ok: false, error: `HTTP ${res.status}: ${errMsg}` }
  }

  return { ok: true, messageId: json?.id }
}

export async function listarGrupos(): Promise<
  { id: string; name: string; participants: number }[]
> {
  if (!API_TOKEN) return []

  const res = await fetch(`${BASE_URL}groups?count=500`, {
    headers: getHeaders(),
  })
  if (!res.ok) return []

  const json = await res.json()
  return (json.groups ?? []).map((g: any) => ({
    id: g.id,
    name: g.name || '',
    participants: g.participants?.length ?? 0,
  }))
}

export async function enviarMensagemParaBot(params: {
  botNumero: string
  texto: string
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!API_TOKEN) {
    return { ok: false, error: 'WHAPI_API_TOKEN não configurado' }
  }

  const res = await fetch(`${BASE_URL}messages/text`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      to: params.botNumero,
      body: params.texto,
    }),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok || json?.errors?.length) {
    const errMsg = json?.errors?.[0]?.message || JSON.stringify(json).slice(0, 200)
    return { ok: false, error: `HTTP ${res.status}: ${errMsg}` }
  }

  return { ok: true, messageId: json?.id }
}

export async function obterMensagensRecebidas(params: {
  botNumero: string
  timeFrom?: number
}): Promise<{
  messages: { id: string; type: string; timestamp: number; text?: string; from_me: boolean }[]
}> {
  if (!API_TOKEN) return { messages: [] }

  const chatId = `${params.botNumero}@s.whatsapp.net`
  const queryParams = new URLSearchParams({
    count: '50',
    from_me: 'false',
    sort: 'desc',
  })
  if (params.timeFrom) {
    queryParams.set('time_from', String(params.timeFrom))
  }

  const res = await fetch(`${BASE_URL}messages/list/${chatId}?${queryParams}`, {
    headers: getHeaders(),
  })

  if (!res.ok) return { messages: [] }

  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (json.messages ?? []).map((m: any) => ({
    id: m.id ?? '',
    type: m.type ?? '',
    timestamp: m.timestamp ?? 0,
    text: m.text?.body ?? undefined,
    from_me: m.from_me ?? false,
  }))

  return { messages }
}
