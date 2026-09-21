import { NextResponse } from 'next/server'
import { listarBlacksenderFlowRuns, listarBlacksenderLeadsPorIds } from '@/lib/db/supabase'
import { calcularEstagiosTag } from '@/lib/blacksender/jornada'

export async function GET(_req: Request, { params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params
  const execucoes = await listarBlacksenderFlowRuns(flowId)

  const porStatus: Record<string, number> = {}
  for (const e of execucoes) {
    const status = e.status ?? 'desconhecido'
    porStatus[status] = (porStatus[status] ?? 0) + 1
  }

  const estagiosTag = calcularEstagiosTag(execucoes)

  // Enriquece cada execução com nome/telefone do lead — painel de análise mostra "quem" além de
  // "quantos", sem precisar de N chamadas separadas pra tela pedir um lead de cada vez.
  const contactIds = [...new Set(execucoes.map((e) => e.contactId).filter((id): id is string => !!id))]
  const leads = await listarBlacksenderLeadsPorIds(contactIds)
  const leadPorId = new Map(leads.map((l) => [l.id, l]))
  const execucoesComLead = execucoes.map((e) => ({
    ...e,
    leadNome: (e.contactId && leadPorId.get(e.contactId)?.nome) ?? null,
    leadTelefone: (e.contactId && leadPorId.get(e.contactId)?.telefone) ?? null,
  }))

  const ultimoLeadEm = execucoes[0]?.criadoEmOrigem ?? null

  return NextResponse.json({ flowId, total: execucoes.length, porStatus, estagiosTag, ultimoLeadEm, execucoes: execucoesComLead })
}
