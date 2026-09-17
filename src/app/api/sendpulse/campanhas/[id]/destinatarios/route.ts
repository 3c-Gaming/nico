import { NextResponse } from 'next/server'
import { buscarCampanhaSendpulseImportada } from '@/lib/db/supabase'
import { listarContasSendpulse } from '@/lib/integrações/contasSendpulse'
import { buscarDestinatariosCampanha } from '@/lib/integrações/sendpulse'

export const maxDuration = 60

/**
 * GET /api/sendpulse/campanhas/[id]/destinatarios
 *
 * Sob demanda (não é buscado junto da listagem principal) — pagina campaigns/recipients e agrega
 * clique por botão, quem clicou, etc. (ver buscarDestinatariosCampanha). Chamado só quando o
 * usuário expande o detalhe de uma campanha específica, porque escanear destinatário por
 * destinatário é mais caro que o /campaigns/report agregado usado na lista.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const importada = await buscarCampanhaSendpulseImportada(id)
    if (!importada) return NextResponse.json({ error: 'Campanha não importada' }, { status: 404 })

    const conta = listarContasSendpulse().find((c) => c.id === importada.contaId)
    if (!conta) return NextResponse.json({ error: `Conta ${importada.contaId} não configurada` }, { status: 404 })

    const resumo = await buscarDestinatariosCampanha(id, conta.apiKey, importada.canal)
    return NextResponse.json({ resumo })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
