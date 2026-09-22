// Espelha src/lib/blacksender/relatorio.ts, mas pra funis SendPulse (WhatsApp ou Telegram — o bot
// resolve o canal sozinho, ver comContaECanalDoBot) — mesmo formato de saída (RelatorioFunil),
// pra alimentar o mesmo embed do relatório horário (ver src/lib/discord/relatorios.ts).

import { comContaECanalDoBot } from '@/lib/integrações/contasSendpulse'
import { contarPorTagIntervaloSendpulse } from '@/lib/integrações/sendpulse'
import { tagDeEntradaDoFluxo, calcularResultadoLinhaNoDia } from '@/lib/funis'
import { buscarEventosTrackingDoDiaServidor, type RelatorioFunilBlacksender } from '@/lib/blacksender/relatorio'
import type { FlowTagConfig } from '@/types'
import type { EstagioFunil } from '@/components/funis/FunilConversaoChart'

// Mesmo formato de RelatorioFunilBlacksender (reaproveitado, apesar do nome) — os dois viram o
// mesmo embed em src/lib/discord/relatorios.ts.
export type RelatorioFunil = RelatorioFunilBlacksender

async function contarTagHoje(botId: string, tag: string, data: string) {
  return comContaECanalDoBot(botId, (apiKey, canal) =>
    contarPorTagIntervaloSendpulse(botId, tag, apiKey, data, data, AbortSignal.timeout(60_000), canal),
  ).catch(() => ({ total: 0, ultimoLeadAt: null as string | null }))
}

/** `todosConfigsSP`, se passado, evita relistar flow_tag_configs a cada funil quando o chamador
 * já processa vários de uma vez (ver montarRelatoriosFunisPinados) — sem ele, busca sozinho. */
export async function calcularRelatorioFunilSendpulse(
  cfg: FlowTagConfig,
  data: string,
  todosConfigsSP?: FlowTagConfig[],
): Promise<RelatorioFunil> {
  const tags = cfg.tags ?? []
  const tagEntrada = tagDeEntradaDoFluxo(tags)
  if (!cfg.botId || !tagEntrada) {
    return { totalLeads: 0, registros: 0, ftds: 0, estagios: [], ultimoLeadEm: null, totalEntradasNoNumero: 0 }
  }

  const [resultadosPorTag, dia] = await Promise.all([
    Promise.all(tags.map((tag) => contarTagHoje(cfg.botId, tag, data))),
    buscarEventosTrackingDoDiaServidor(data),
  ])
  const estagios: EstagioFunil[] = tags.map((tag, i) => ({ tag, contagem: resultadosPorTag[i].total }))
  const totalLeads = resultadosPorTag[0]?.total ?? 0
  const ultimoLeadEm = resultadosPorTag[0]?.ultimoLeadAt ?? null
  const { registros, ftds } = calcularResultadoLinhaNoDia(cfg, dia)

  // "Total de Entradas no Número" = soma da tag de entrada de todos os funis SendPulse que
  // compartilham o mesmo botId (mesma definição usada pro Black Sender, por canal lá — aqui é
  // por bot, que já é nativo no FlowTagConfig, sem precisar derivar de nada).
  let totalEntradasNoNumero = totalLeads
  const configs = todosConfigsSP
  if (configs) {
    const irmaos = configs.filter((c) => c.botId === cfg.botId && c.flowId !== cfg.flowId)
    const contagensIrmaos = await Promise.all(irmaos.map(async (c) => {
      const tagEnt = tagDeEntradaDoFluxo(c.tags)
      if (!c.botId || !tagEnt) return 0
      return (await contarTagHoje(c.botId, tagEnt, data)).total
    }))
    totalEntradasNoNumero += contagensIrmaos.reduce((a, b) => a + b, 0)
  }

  return {
    totalLeads: Math.round(totalLeads),
    registros: Math.round(registros),
    ftds: Math.round(ftds),
    estagios,
    ultimoLeadEm,
    totalEntradasNoNumero: Math.round(totalEntradasNoNumero),
  }
}
