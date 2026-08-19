// Lógica compartilhada entre a tela de Funis e a apresentação por dia (src/app/funis/apresentar) —
// cálculo de leads/registros/FTDs/conversão por funil por dia, mesma fonte pros dois: tracking
// 3CGG (registros/FTDs) + SendPulse via sendpulseLeads.ts (leads).

import { contarLeadsIntervalo, type GrupoBotTags } from './sendpulseLeads'
import type { CampanhaMeta } from '@/app/api/meta-ads/campanhas/route'

// Um fluxo pode ter mais de uma UTM/PID (ex: mesmo funil rodando em duas campanhas
// diferentes) — soma os resultados de todas ao invés de só olhar a principal.
export function utmsDoFluxo(c: { utm?: string | null; utmsExtras?: string[] }): string[] {
  return [c.utm, ...(c.utmsExtras ?? [])].filter((u): u is string => !!u)
}

// Quando um fluxo tem várias tags (jornada de qualificação — ver FlowTagEditor), elas marcam
// etapas que o MESMO lead passa a acumular, não leads diferentes. "Leads hoje"/"Total" não podem
// somar a contagem de todas as tags (contaria o mesmo lead uma vez por etapa já cumprida) — só a
// primeira tag (o ponto de entrada do fluxo) representa a contagem real de leads únicos.
export function tagDeEntradaDoFluxo(tags?: string[]): string | undefined {
  return tags?.[0]
}

export function gerarRangeDatas(inicio: string, fim: string): string[] {
  const datas: string[] = []
  const atual = new Date(`${inicio}T00:00:00`)
  const fimDate = new Date(`${fim}T00:00:00`)
  while (atual <= fimDate) {
    datas.push(`${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}-${String(atual.getDate()).padStart(2, '0')}`)
    atual.setDate(atual.getDate() + 1)
  }
  return datas
}

export interface ResultadoDia {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  superbetEvents: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  betmgmEvents: any[]
  leadsPorTag: Record<string, number>
}

/** Resultado (registros/FTDs por casa + leads por tag) de um dia específico. Registros/FTDs vêm
 * do tracking 3CGG (rápido, ~1s). Leads por tag direto na SendPulse (getByTag paginado, agrupado
 * por bot) — cada dia dispara uma chamada por bot; dias diferentes rodam em paralelo entre si. */
export async function buscarResultadosDoDia(data: string, gruposBotTags: GrupoBotTags[]): Promise<ResultadoDia> {
  const [superbetRes, betmgmRes, leadsPorTag] = await Promise.all([
    fetch(`/api/tracking/export?casa=superbet&date=${data}`).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    fetch(`/api/tracking/export?casa=betmgm&date=${data}`).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    gruposBotTags.length === 0
      ? Promise.resolve({} as Record<string, number>)
      : contarLeadsIntervalo(gruposBotTags, data, data),
  ])
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    superbetEvents: (superbetRes as any)?.data ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    betmgmEvents: (betmgmRes as any)?.data ?? [],
    leadsPorTag,
  }
}

export interface ResultadoLinhaDia {
  leads: number
  registros: number
  ftds: number
  convFtd: number | null // percentual (ex: 19.1), não fração 0-1
  convReg: number | null
}

/** Aplica o resultado de um dia (ver buscarResultadosDoDia) numa linha (config de fluxo com
 * tags/utm) — mesma conta usada tanto na exportação de CSV por intervalo quanto na apresentação
 * por dia, pra não divergir entre as duas telas. */
export function calcularResultadoLinhaNoDia(
  cfg: { tags?: string[]; utm?: string | null; utmsExtras?: string[] },
  dia: ResultadoDia,
): ResultadoLinhaDia {
  const utms = utmsDoFluxo(cfg)
  let registros = 0
  let ftds = 0
  for (const item of dia.superbetEvents) {
    if (utms.some((utm) => String(item.acid).includes(utm))) {
      registros += item.registrations ?? 0
      ftds += item.ftds ?? 0
    }
  }
  for (const item of dia.betmgmEvents) {
    if (utms.some((utm) => String(item.marketing_source_id) === utm)) {
      registros += item.registrations ?? 0
      ftds += item.ftds ?? 0
    }
  }
  const tagEntrada = tagDeEntradaDoFluxo(cfg.tags)
  const leads = tagEntrada ? (dia.leadsPorTag[tagEntrada] ?? 0) : 0
  const convFtd = leads > 0 ? (ftds / leads) * 100 : null
  const convReg = leads > 0 ? (registros / leads) * 100 : null
  return { leads, registros, ftds, convFtd, convReg }
}

/** Quantos funis (do sistema inteiro, não só os visíveis numa tela filtrada) têm cada campanha do
 * Meta atribuída — uma mesma campanha pode ter rodado pra vários funis ao mesmo tempo (ex: um
 * anúncio que manda pra 4 variantes de teste). Nesse caso o gasto dela não pode ser contado
 * inteiro em cada funil, senão o total fica multiplicado pelo número de funis que a compartilham. */
export function contarFunisPorCampanha(linhas: { campanhasMeta?: string[] }[]): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const linha of linhas) {
    for (const nome of linha.campanhasMeta ?? []) {
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1)
    }
  }
  return contagem
}

/** Soma o gasto das campanhas do Meta atribuídas manualmente a esse funil (ver painel de
 * Detalhes) — campanhas não atribuídas ou nomes que não aparecem no período não contam. Campanhas
 * compartilhadas com outros funis (ver contarFunisPorCampanha) têm o gasto dividido entre eles,
 * pra não contar o mesmo real gasto mais de uma vez no total. */
export function gastoDoFunil(campanhasMeta: string[] | undefined, campanhas: CampanhaMeta[], funisPorCampanha: Map<string, number>): number {
  if (!campanhasMeta || campanhasMeta.length === 0) return 0
  const atribuidas = new Set(campanhasMeta)
  return campanhas
    .filter((c) => atribuidas.has(c.nome))
    .reduce((soma, c) => soma + c.gasto / (funisPorCampanha.get(c.nome) ?? 1), 0)
}
