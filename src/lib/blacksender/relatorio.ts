// Cálculo do "leads de um funil Black Sender num dia" — extraído de handleLeads (comando /leads
// do Discord) pra ser reaproveitado também pelo relatório horário (ver src/lib/discord/relatorios.ts
// e /api/cron/discord-report), sem duplicar a lógica de "leads novos do dia + tags acumuladas +
// soma dos funis irmãos no mesmo número" nos dois lugares.

import { listarBlacksenderFlowRuns, listarBlacksenderLeadsNovosDoFlowNoDia } from '@/lib/db/supabase'
import { calcularEstagiosTag, canalDoFluxo } from './jornada'
import type { FlowTagConfig } from '@/types'
import type { EstagioFunil } from '@/components/funis/FunilConversaoChart'

export interface RelatorioFunilBlacksender {
  totalLeads: number
  estagios: EstagioFunil[]
  ultimoLeadEm: string | null
  totalEntradasNoNumero: number
}

/** `todosConfigsBS`, se passado, evita relistar flow_tag_configs a cada funil quando o chamador
 * já processa vários de uma vez (ver montarRelatoriosFunisPinados) — sem ele, busca sozinho. */
export async function calcularRelatorioFunilBlacksender(
  cfg: FlowTagConfig,
  data: string,
  todosConfigsBS?: FlowTagConfig[],
): Promise<RelatorioFunilBlacksender> {
  const configs = todosConfigsBS ?? (await (async () => {
    const { listarFlowTagConfigs } = await import('@/lib/db/supabase')
    return (await listarFlowTagConfigs()).filter((c) => c.origem === 'blacksender')
  })())

  const [leadsNovos, execucoes] = await Promise.all([
    listarBlacksenderLeadsNovosDoFlowNoDia(cfg.flowId, data),
    listarBlacksenderFlowRuns(cfg.flowId),
  ])
  const idsDoDia = new Set(leadsNovos.map((l) => l.id))
  const estagios = calcularEstagiosTag(execucoes, idsDoDia)
  const ultimoLeadEm = leadsNovos.reduce<string | null>(
    (max, l) => (l.criadoEmOrigem && (!max || l.criadoEmOrigem > max) ? l.criadoEmOrigem : max), null,
  )
  const canal = canalDoFluxo(execucoes)

  // "Total de Entradas no Número" = soma dos leads do dia de todos os funis que rodam no mesmo
  // canal (ver definição escolhida no /leads) — inclui o próprio cfg.
  let totalEntradas = leadsNovos.length
  if (canal) {
    const outrosDoCanal = await Promise.all(
      configs.filter((c) => c.flowId !== cfg.flowId).map(async (c) => ({
        c, canal: canalDoFluxo(await listarBlacksenderFlowRuns(c.flowId)),
      })),
    )
    const irmaos = outrosDoCanal.filter((x) => x.canal === canal).map((x) => x.c)
    const contagens = await Promise.all(irmaos.map((c) => listarBlacksenderLeadsNovosDoFlowNoDia(c.flowId, data)))
    totalEntradas += contagens.reduce((soma, arr) => soma + arr.length, 0)
  }

  return { totalLeads: leadsNovos.length, estagios, ultimoLeadEm, totalEntradasNoNumero: totalEntradas }
}
