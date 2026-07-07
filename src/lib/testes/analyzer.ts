import type { TestRequest, TestResult, LinkVerificado } from './types'

const URL_REGEX = /https?:\/\/[^\s<>"']+/g

function extrairLinks(texto: string): string[] {
  return texto.match(URL_REGEX) || []
}

function extrairUtms(url: string): Record<string, string> {
  try {
    const parsed = new URL(url)
    const utms: Record<string, string> = {}
    for (const [key, val] of parsed.searchParams.entries()) {
      if (key.startsWith('utm_') || key.toLowerCase() === 'pid') {
        utms[key] = val
      }
    }
    return utms
  } catch {
    return {}
  }
}

export async function analisarResposta(
  resposta: string,
  request: TestRequest,
  duracaoMs: number
): Promise<Pick<TestResult, 'status' | 'respostaRecebida' | 'linksEncontrados' | 'linksVerificados'>> {
  const links = extrairLinks(resposta)

  if (!request.expect && links.length === 0) {
    return {
      status: 'ok',
      respostaRecebida: resposta,
      linksEncontrados: [],
      linksVerificados: [],
    }
  }

  const linksVerificados: LinkVerificado[] = links.map((url) => ({
    url,
    utms: extrairUtms(url),
  }))

  if (request.expect?.utms) {
    for (const link of linksVerificados) {
      for (const [chave, valorEsperado] of Object.entries(request.expect.utms)) {
        const valorAtual = link.utms[chave]
        if (valorAtual !== valorEsperado) {
          return {
            status: 'copy_incorreta',
            respostaRecebida: resposta,
            linksEncontrados: links,
            linksVerificados,
          }
        }
      }
    }
  }

  if (request.expect?.linksEsperados !== undefined && links.length < request.expect.linksEsperados) {
    return {
      status: 'link_quebrado',
      respostaRecebida: resposta,
      linksEncontrados: links,
      linksVerificados,
    }
  }

  if (request.expect?.copyContains) {
    const textoLower = resposta.toLowerCase()
    const todasEncontradas = request.expect.copyContains.every((f) =>
      textoLower.includes(f.toLowerCase())
    )
    if (!todasEncontradas) {
      return {
        status: 'copy_incorreta',
        respostaRecebida: resposta,
        linksEncontrados: links,
        linksVerificados,
      }
    }
  }

  return {
    status: 'ok',
    respostaRecebida: resposta,
    linksEncontrados: links,
    linksVerificados,
  }
}
