import { NextResponse } from 'next/server'
import { contaBridgeDoPainel } from '@/lib/pilhadoPremios'
import { buscarVendasPorDia } from '@/lib/integrações/h2premios'
import { getDisparoPilhado, atualizarDisparoPilhado } from '@/lib/db/supabase'
import { primeiroDiaDoMes } from '@/lib/datas'

// Scrape de um mês inteiro pode passar dos 10-15s padrão da Vercel — sem isso a função é morta
// antes do bridge responder e o usuário só vê um erro genérico de timeout.
export const maxDuration = 280

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const disparo = await getDisparoPilhado(id)
  if (!disparo) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const conta = contaBridgeDoPainel(disparo.painel)
  if (!conta) {
    return NextResponse.json({ error: `Painel "${disparo.painel}" não reconhecido — não sei qual conta do h2premios usar` }, { status: 400 })
  }

  try {
    // Busca o mês inteiro do disparo (não só o dia exato) — cobre vendas de outros disparos do
    // mesmo mês/painel de uma vez e compartilha o cache com o botão "Sincronizar mês" e o cron.
    const desde = primeiroDiaDoMes(disparo.data)
    const porDia = await buscarVendasPorDia(conta, desde)
    const doDia = porDia[disparo.data] ?? { vendas: 0, faturamento: 0 }

    const atualizado = await atualizarDisparoPilhado(id, {
      vendas: doDia.vendas,
      faturamento: doDia.faturamento,
    })
    return NextResponse.json({ disparo: atualizado })
  } catch (err) {
    console.error('[api/pilhado-premios/sincronizar]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
