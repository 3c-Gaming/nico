import type { LinkVerificado } from './types'

export async function verificarLink(url: string): Promise<LinkVerificado> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })

    const utms: Record<string, string> = {}
    try {
      const parsed = new URL(response.url || url)
      for (const [key, val] of parsed.searchParams.entries()) {
        if (key.startsWith('utm_') || key.toLowerCase() === 'pid') {
          utms[key] = val
        }
      }
    } catch {}

    return {
      url: response.url || url,
      statusCode: response.status,
      utms,
    }
  } catch (err) {
    return {
      url,
      statusCode: undefined,
      utms: {},
    }
  }
}

export async function verificarLinks(urls: string[]): Promise<LinkVerificado[]> {
  return Promise.all(urls.map(verificarLink))
}
