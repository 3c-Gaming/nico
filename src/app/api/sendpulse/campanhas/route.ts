import { NextRequest, NextResponse } from 'next/server'
import {
  listarCampanhasSendpulseImportadas,
  criarCampanhaSendpulseImportada,
  deletarCampanhaSendpulseImportada,
  atualizarUtmCampanhaSendpulse,
} from '@/lib/db/supabase'
import { listarContasSendpulse } from '@/lib/integrações/contasSendpulse'
import { buscarCampanhaSendpulse, resolverContaDaCampanha, extrairIdCampanhaSendpulse } from '@/lib/integrações/sendpulse'
import { buscarEventosTrackingDoDia } from '@/lib/tracking'
import { calcularResultadoLinhaNoDia, gerarRangeDatas } from '@/lib/funis'
import { hojeBrasilISO } from '@/lib/datas'
import type { CampanhaSendpulseImportada, RelatorioCampanhaSendpulse } from '@/types'

export const maxDuration = 30

function primeiroDiaDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`
}

// Campanha é um broadcast pontual — conversão que ainda ia acontecer 2 semanas depois do envio
// não é realista de esperar. Trava o range pra não escanear meses de tracking por campanha velha.
const MAX_DIAS_UTM = 14

/** Registros/FTDs reais (tracking SuperBet/BetMGM) das campanhas com UTM vinculada — soma dia a
 * dia desde o envio (ou criação, se não tiver send_at) até hoje, mesmo princípio do cálculo em
 * src/lib/funis.ts, só que aqui olhando o histórico inteiro da campanha em vez de "hoje". Busca
 * cada dia UMA vez só (não por campanha) mesmo que várias campanhas compartilhem dias. */
async function calcularResultadosPorUtm(campanhas: CampanhaSendpulseImportada[]): Promise<Map<string, { registros: number; ftds: number }>> {
  const comUtm = campanhas.filter((c) => c.utm)
  if (comUtm.length === 0) return new Map()

  const hoje = hojeBrasilISO()
  const diasPorCampanha = new Map<string, string[]>()
  const todosDias = new Set<string>()
  for (const c of comUtm) {
    const inicio = (c.sendAt ?? c.criadoEmSendpulse).slice(0, 10)
    const dias = gerarRangeDatas(inicio, hoje).slice(-MAX_DIAS_UTM)
    diasPorCampanha.set(c.id, dias)
    for (const d of dias) todosDias.add(d)
  }

  const eventosPorDia = new Map<string, { superbetEvents: unknown[]; betmgmEvents: unknown[] }>()
  await Promise.all(
    [...todosDias].map(async (dia) => {
      const [superbetEvents, betmgmEvents] = await Promise.all([
        buscarEventosTrackingDoDia('superbet', dia).catch(() => []),
        buscarEventosTrackingDoDia('betmgm', dia).catch(() => []),
      ])
      eventosPorDia.set(dia, { superbetEvents, betmgmEvents })
    }),
  )

  const resultado = new Map<string, { registros: number; ftds: number }>()
  for (const c of comUtm) {
    let registros = 0
    let ftds = 0
    for (const dia of diasPorCampanha.get(c.id) ?? []) {
      const eventos = eventosPorDia.get(dia)
      if (!eventos) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = calcularResultadoLinhaNoDia({ utm: c.utm }, { ...(eventos as any), leadsPorTag: {} })
      registros += r.registros
      ftds += r.ftds
    }
    resultado.set(c.id, { registros: Math.round(registros), ftds: Math.round(ftds) })
  }
  return resultado
}

/**
 * GET /api/sendpulse/campanhas?desde=YYYY-MM-DD
 *
 * Lista campanhas importadas (ver POST) com os números atualizados na hora — a SendPulse não tem
 * webhook/push pra isso, só dá pra saber o estado atual buscando de novo (ver
 * buscarCampanhaSendpulse). `desde` filtra pela data de criação NA SENDPULSE (não a de importação
 * aqui) — default primeiro dia do mês corrente, conforme pedido. Campanhas com UTM vinculada
 * ganham registros/ftds reais do tracking (ver calcularResultadosPorUtm).
 */
export async function GET(request: NextRequest) {
  const desde = request.nextUrl.searchParams.get('desde') || primeiroDiaDoMes(hojeBrasilISO())

  try {
    const importadas = await listarCampanhasSendpulseImportadas()
    const contas = listarContasSendpulse()

    const [resultados, resultadosUtm] = await Promise.all([
      Promise.allSettled(
        importadas.map(async (c) => {
          const conta = contas.find((x) => x.id === c.contaId)
          const relatorio = conta ? await buscarCampanhaSendpulse(c.id, conta.apiKey, c.canal) : null
          return { importada: c, relatorio }
        }),
      ),
      calcularResultadosPorUtm(importadas),
    ])

    const campanhas = resultados
      .filter((r): r is PromiseFulfilledResult<{ importada: CampanhaSendpulseImportada; relatorio: RelatorioCampanhaSendpulse | null }> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter(({ importada }) => importada.criadoEmSendpulse >= desde)
      .map(({ importada, relatorio }) => ({ ...importada, relatorio, resultadoUtm: resultadosUtm.get(importada.id) ?? null }))
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

/**
 * PATCH /api/sendpulse/campanhas
 * body: { id: string; utm: string | null }
 *
 * Vincula (ou remove) a UTM/PID de uma campanha já importada — usada pra cruzar com registros/
 * FTDs reais do tracking (ver GET acima).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { id?: string; utm?: string | null }
    if (!body.id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    const salva = await atualizarUtmCampanhaSendpulse(body.id, body.utm?.trim() || null)
    return NextResponse.json({ campanha: salva })
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
