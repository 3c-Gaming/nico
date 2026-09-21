import { NextResponse } from 'next/server'
import { listarBlacksenderFlowRuns, listarBlacksenderLeadsPorIds, listarBlacksenderLeadsNovosDoFlowNoDia } from '@/lib/db/supabase'
import { calcularEstagiosTag } from '@/lib/blacksender/jornada'
import { hojeBrasilISO } from '@/lib/datas'

export async function GET(req: Request, { params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params
  const data = new URL(req.url).searchParams.get('data') || hojeBrasilISO()
  const [execucoes, leadsNovosDoDia] = await Promise.all([
    listarBlacksenderFlowRuns(flowId),
    listarBlacksenderLeadsNovosDoFlowNoDia(flowId, data),
  ])

  const porStatus: Record<string, number> = {}
  for (const e of execucoes) {
    const status = e.status ?? 'desconhecido'
    porStatus[status] = (porStatus[status] ?? 0) + 1
  }

  // Escopado pro dia pedido (não pra todas as execuções desde sempre) — sem isso, o funil de
  // conversão da jornada mostrava número muito maior que "Total de Leads" (que é sempre de hoje),
  // como se a tag de entrada tivesse muito mais gente do que os leads novos do dia mostrados logo
  // acima no mesmo painel.
  const idsDoDia = new Set(leadsNovosDoDia.map((l) => l.id))
  const estagiosTag = calcularEstagiosTag(execucoes, idsDoDia)

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
