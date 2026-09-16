// Gera o snapshot diário de um funil (leads/registros/FTDs/tags/custos/ROI) server-side — usado
// tanto pela rota disparada ao Salvar um funil (dia corrente) quanto pelo cron de fechamento do
// dia anterior. Reaproveita as mesmas fórmulas da tela de Funis (src/lib/funis.ts) e os mesmos
// clientes de API já usados pelas rotas equivalentes client-side, só que chamados direto (sem
// fetch relativo, que não funciona fora do browser).

import type { CasaAposta, FlowTagConfig, FunilMetricaDiaria } from '@/types'
import { comContaECanalDoBot } from './integrações/contasSendpulse'
import { contarPorTagIntervaloSendpulse } from './integrações/sendpulse'
import { buscarEventosTrackingDoDia } from './tracking'
import { buscarCampanhasMeta, type CampanhaMeta } from './metaAds'
import { listarCasas, listarFlowTagConfigs } from './db/supabase'
import { chaveTagBot } from './sendpulseLeads'
import { calcularSnapshotDoFunil, contarFunisPorCampanha, contarFunisPorUtm, gastoDoFunil } from './funis'

export interface ContextoSnapshot {
  casasAposta: CasaAposta[]
  campanhasMetaDoPeriodo: CampanhaMeta[]
  funisPorCampanha: Map<string, number>
  funisPorUtm: Map<string, number>
}

/** Carrega tudo que é compartilhado entre vários funis num mesmo snapshot (casas, campanhas do
 * dia, divisores de UTM/campanha compartilhada) — uma vez só, reaproveitado pra cada funil, em vez
 * de refazer a cada chamada de gerarSnapshotDoFunil (ver cron/funil-metricas-snapshot, que itera
 * todos os funis configurados). */
export async function carregarContextoSnapshot(data: string): Promise<ContextoSnapshot> {
  const [casasAposta, todasConfigs, campanhasMetaDoPeriodo] = await Promise.all([
    listarCasas(),
    listarFlowTagConfigs(),
    buscarCampanhasMeta(data, data).catch(() => [] as CampanhaMeta[]),
  ])
  return {
    casasAposta,
    campanhasMetaDoPeriodo,
    funisPorCampanha: contarFunisPorCampanha(todasConfigs),
    funisPorUtm: contarFunisPorUtm(todasConfigs),
  }
}

/** Snapshot de UM funil pra UMA data — contagem de leads por tag direto na SendPulse (uma chamada
 * por tag, resolve conta/canal sozinho via comContaECanalDoBot) + eventos de tracking
 * (Superbet/BetMGM) do dia + gasto de Meta já atribuído (campanhasMeta). Tag/tracking que falhar
 * fica zerado em vez de derrubar o snapshot inteiro — mesmo princípio de tolerância a falha parcial
 * já usado no resto do sistema (Promise.allSettled). */
export async function gerarSnapshotDoFunil(
  config: FlowTagConfig,
  data: string,
  ctx: ContextoSnapshot,
): Promise<Omit<FunilMetricaDiaria, 'atualizadoEm'>> {
  const tags = config.tags ?? []
  const tagsContagem: Record<string, number> = {}
  const leadsPorTag: Record<string, number> = {}

  await Promise.allSettled(
    tags.map(async (tag) => {
      const resultado = await comContaECanalDoBot(config.botId, (apiKey, canal) =>
        contarPorTagIntervaloSendpulse(config.botId, tag, apiKey, data, data, AbortSignal.timeout(60_000), canal),
      )
      tagsContagem[tag] = resultado.total
      leadsPorTag[chaveTagBot(config.botId, tag)] = resultado.total
    }),
  )

  const [superbetEvents, betmgmEvents] = await Promise.all([
    buscarEventosTrackingDoDia('superbet', data).catch(() => []),
    buscarEventosTrackingDoDia('betmgm', data).catch(() => []),
  ])

  const gasto = gastoDoFunil(config.campanhasMeta, ctx.campanhasMetaDoPeriodo, ctx.funisPorCampanha)
  const base = calcularSnapshotDoFunil(config, { superbetEvents, betmgmEvents, leadsPorTag }, ctx.casasAposta, gasto, ctx.funisPorUtm)

  return {
    flowId: config.flowId,
    data,
    funil: config.funil ?? null,
    tagsContagem,
    ...base,
  }
}
