// Cálculo do "leads de um funil Black Sender num dia" — extraído de handleLeads (comando /leads
// do Discord) pra ser reaproveitado também pelo relatório horário (ver src/lib/discord/relatorios.ts
// e /api/cron/discord-report), sem duplicar a lógica de "leads novos do dia + tags acumuladas +
// soma dos funis irmãos no mesmo número" nos dois lugares.

import { listarBlacksenderFlowRuns, listarBlacksenderLeadsNovosDoFlowNoDia } from '@/lib/db/supabase'
import { buscarEventosTrackingDoDia } from '@/lib/tracking'
import { calcularResultadoLinhaNoDia } from '@/lib/funis'
import { calcularEstagiosTag, canalDoFluxo } from './jornada'
import type { FlowTagConfig } from '@/types'
import type { EstagioFunil } from '@/components/funis/FunilConversaoChart'

export interface RelatorioFunilBlacksender {
  totalLeads: number
  registros: number
  ftds: number
  estagios: EstagioFunil[]
  ultimoLeadEm: string | null
  totalEntradasNoNumero: number
}

/** Registros/FTDs vêm do tracking 3CGG matched por UTM (mesmo mecanismo do painel web — ver
 * calcularResultadoLinhaNoDia/calcularSnapshotDoFunil em src/lib/funis.ts), independente da
 * origem do funil. buscarResultadosDoDia (usado no painel) faz fetch de URL relativa, o que não
 * funciona rodando fora do browser (comando Discord/cron) — direto na função server-side aqui. */
export async function buscarEventosTrackingDoDiaServidor(data: string) {
  const [superbetEvents, betmgmEvents] = await Promise.all([
    buscarEventosTrackingDoDia('superbet', data).catch(() => []),
    buscarEventosTrackingDoDia('betmgm', data).catch(() => []),
  ])
  return { superbetEvents, betmgmEvents, leadsPorTag: {} }
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

  const [leadsNovos, execucoes, dia] = await Promise.all([
    listarBlacksenderLeadsNovosDoFlowNoDia(cfg.flowId, data),
    listarBlacksenderFlowRuns(cfg.flowId),
    buscarEventosTrackingDoDiaServidor(data),
  ])
  const { registros, ftds } = calcularResultadoLinhaNoDia({ ...cfg, origem: 'blacksender' }, dia)
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

  return {
    totalLeads: leadsNovos.length,
    registros: Math.round(registros),
    ftds: Math.round(ftds),
    estagios,
    ultimoLeadEm,
    totalEntradasNoNumero: totalEntradas,
  }
}
