// Consulta o Supabase de "betting_links" — projeto EXTERNO a esse app (não é o mesmo Supabase do
// Nico), mantido por outro sistema que gera/publica bilhetes de aposta pronta (ex: Superbet) pra
// cada "casa" configurada. Read-only: só faz GET, nunca escreve nada nesse banco.

export interface BettingLink {
  id: string
  casa: string
  dataJogo: string
  horarioJogo: string
  link: string
  ativo: boolean
  criadoEm: string
}

function baseUrl(): string {
  const url = process.env.BETTING_LINKS_SUPABASE_URL
  if (!url) throw new Error('BETTING_LINKS_SUPABASE_URL não configurado')
  return url
}

function apiKey(): string {
  const key = process.env.BETTING_LINKS_SUPABASE_KEY
  if (!key) throw new Error('BETTING_LINKS_SUPABASE_KEY não configurado')
  return key
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizar(item: any): BettingLink {
  return {
    id: item.id,
    casa: item.casa,
    dataJogo: item.data_jogo,
    horarioJogo: item.horario_jogo,
    link: item.link,
    ativo: item.ativo,
    criadoEm: item.created_at,
  }
}

/** Bilhetes ativos de uma "casa" (ex: superbet, superbet_odm, superbet_1k) — mais recente
 * primeiro (order=created_at.desc), igual ao curl de referência. Lista vazia = casa sem bilhete
 * ativo agora, não é erro. */
export async function buscarBilhetesAtivos(casa: string, signal?: AbortSignal): Promise<BettingLink[]> {
  const url = `${baseUrl()}/rest/v1/betting_links?casa=eq.${encodeURIComponent(casa)}&ativo=eq.true&order=created_at.desc`
  const key = apiKey()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    signal,
  })
  if (!res.ok) throw new Error(`betting_links (${casa}): HTTP ${res.status}`)
  const data = await res.json()
  return (Array.isArray(data) ? data : []).map(normalizar)
}
