import { NextResponse } from 'next/server'
import { contaBridgeDoPainel, PAINEIS_PILHADO } from '@/lib/pilhadoPremios'
import { buscarResultadoEdicao } from '@/lib/integrações/h2premios'
import { listarConfigsPilhadoPremios, upsertConfigPilhadoPremios } from '@/lib/db/supabase'

// Escolher a edição e ler os cards dela num passo só (o botão do app faz "salvar e sincronizar"
// de uma vez, não precisa de duas chamadas).
export const maxDuration = 120

export async function GET() {
  const configs = await listarConfigsPilhadoPremios()
  return NextResponse.json({ configs })
}

export async function PUT(request: Request) {
  const { painel, edicaoId } = await request.json()
  if (!painel || !edicaoId) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios: painel, edicaoId' }, { status: 400 })
  }
  if (!PAINEIS_PILHADO.includes(painel)) {
    return NextResponse.json({ error: `Painel "${painel}" não reconhecido` }, { status: 400 })
  }
  const conta = contaBridgeDoPainel(painel)
  if (!conta) {
    return NextResponse.json({ error: `Painel "${painel}" não reconhecido — não sei qual conta do h2premios usar` }, { status: 400 })
  }

  try {
    const resultado = await buscarResultadoEdicao(conta, edicaoId)
    const config = await upsertConfigPilhadoPremios({
      painel,
      edicaoId: resultado.edicaoId,
      edicaoLabel: resultado.edicaoLabel,
      receitaVendas: resultado.receitaVendas,
      ticketMedio: resultado.ticketMedio,
      quantidadeCompras: resultado.quantidadeCompras,
      clientesCaptados: resultado.clientesCaptados,
      atualizadoEm: new Date().toISOString(),
    })
    return NextResponse.json({ config })
  } catch (err) {
    console.error('[api/pilhado-premios/config]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
