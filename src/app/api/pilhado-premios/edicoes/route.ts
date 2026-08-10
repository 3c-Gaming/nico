import { NextResponse } from 'next/server'
import { contaBridgeDoPainel } from '@/lib/pilhadoPremios'
import { listarEdicoes } from '@/lib/integrações/h2premios'

export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const painel = searchParams.get('painel') ?? ''
  const conta = contaBridgeDoPainel(painel)
  if (!conta) {
    return NextResponse.json({ error: `Painel "${painel}" não reconhecido` }, { status: 400 })
  }

  try {
    const edicoes = await listarEdicoes(conta)
    return NextResponse.json({ edicoes })
  } catch (err) {
    console.error('[api/pilhado-premios/edicoes]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
