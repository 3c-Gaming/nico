import { NextRequest, NextResponse } from 'next/server'
import {
  listarCampanhasSendpulseImportadas,
  criarCampanhaSendpulseImportada,
  deletarCampanhaSendpulseImportada,
} from '@/lib/db/supabase'
import { listarContasSendpulse } from '@/lib/integrações/contasSendpulse'
import { buscarCampanhaSendpulse, resolverContaDaCampanha, extrairIdCampanhaSendpulse } from '@/lib/integrações/sendpulse'
import { hojeBrasilISO } from '@/lib/datas'
import type { CampanhaSendpulseImportada, RelatorioCampanhaSendpulse } from '@/types'

export const maxDuration = 30

function primeiroDiaDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`
}

/**
 * GET /api/sendpulse/campanhas?desde=YYYY-MM-DD
 *
 * Lista campanhas importadas (ver POST) com os números atualizados na hora — a SendPulse não tem
 * webhook/push pra isso, só dá pra saber o estado atual buscando de novo (ver
 * buscarCampanhaSendpulse). `desde` filtra pela data de criação NA SENDPULSE (não a de importação
 * aqui) — default primeiro dia do mês corrente, conforme pedido.
 */
export async function GET(request: NextRequest) {
  const desde = request.nextUrl.searchParams.get('desde') || primeiroDiaDoMes(hojeBrasilISO())

  try {
    const importadas = await listarCampanhasSendpulseImportadas()
    const contas = listarContasSendpulse()

    const resultados = await Promise.allSettled(
      importadas.map(async (c) => {
        const conta = contas.find((x) => x.id === c.contaId)
        const relatorio = conta ? await buscarCampanhaSendpulse(c.id, conta.apiKey, c.canal) : null
        return { importada: c, relatorio }
      }),
    )

    const campanhas = resultados
      .filter((r): r is PromiseFulfilledResult<{ importada: CampanhaSendpulseImportada; relatorio: RelatorioCampanhaSendpulse | null }> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter(({ importada }) => importada.criadoEmSendpulse >= desde)
      .map(({ importada, relatorio }) => ({ ...importada, relatorio }))
      .sort((a, b) => b.criadoEmSendpulse.localeCompare(a.criadoEmSendpulse))

    return NextResponse.json({ desde, campanhas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

/**
 * POST /api/sendpulse/campanhas
 * body: { input: string } — link do painel da SendPulse ou ID cru da campanha.
 *
 * Sem endpoint de listagem na SendPulse (ver AI/sendpulse-api.md) — a única forma de saber que
 * uma campanha existe é o usuário colar o ID/link dela aqui. Resolve sozinho em qual das contas
 * configuradas ela está (resolverContaDaCampanha).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { input?: string }
    const id = extrairIdCampanhaSendpulse(body.input ?? '')
    if (!id) return NextResponse.json({ error: 'Link ou ID de campanha inválido' }, { status: 400 })

    const resolvido = await resolverContaDaCampanha(id)
    if (!resolvido) return NextResponse.json({ error: 'Campanha não encontrada em nenhuma conta SendPulse configurada' }, { status: 404 })

    const { contaId, relatorio } = resolvido
    const campanha: CampanhaSendpulseImportada = {
      id: relatorio.id,
      contaId,
      botId: relatorio.botId,
      canal: 'telegram',
      titulo: relatorio.titulo,
      sendAt: relatorio.sendAt,
      criadoEmSendpulse: relatorio.criadoEm,
      importadoEm: new Date().toISOString(),
    }
    const salva = await criarCampanhaSendpulseImportada(campanha)
    return NextResponse.json({ campanha: { ...salva, relatorio } })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  await deletarCampanhaSendpulseImportada(id)
  return NextResponse.json({ ok: true })
}
