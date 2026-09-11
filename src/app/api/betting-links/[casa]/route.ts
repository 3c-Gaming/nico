import { NextResponse } from 'next/server'
import { buscarBilhetesAtivos } from '@/lib/integrações/bettingLinks'

export const maxDuration = 15

/**
 * Endpoint pensado pra ser chamado por fora (ex: nó HTTP de um fluxo de CRM) — sem header nem
 * body, só a URL com a casa no path. Devolve texto puro (não JSON): a própria string do link do
 * bilhete pronto mais recente e ativo daquela casa, pra cair direto numa variável do fluxo.
 * POST é o método real (é o que o nó HTTP do fluxo manda); GET fica de bônus pra testar no navegador/curl.
 */
async function handler(_request: Request, { params }: { params: Promise<{ casa: string }> }) {
  const { casa } = await params
  if (!casa) {
    return new NextResponse('casa não informada', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  try {
    const bilhetes = await buscarBilhetesAtivos(casa, AbortSignal.timeout(10_000))
    const link = bilhetes[0]?.link
    if (!link) {
      return new NextResponse('', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    return new NextResponse(link, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (err) {
    console.error(`[betting-links/${casa}]`, err)
    return new NextResponse('erro ao buscar bilhete', { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}

export const GET = handler
export const POST = handler
