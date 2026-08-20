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
/** Acha, entre as UTMs do fluxo, qual bate com o valor do item de tracking — "includes" pra
 * Superbet (acid costuma trazer a UTM embutida num id maior), igualdade exata pra BetMGM
 * (marketing_source_id é a própria UTM). Retorna a UTM específica que casou (não só um booleano)
 * pra dar pra saber o divisor certo quando ela é compartilhada com outros funis. */
function utmQueCasou(utms: string[], valor: string, exato: boolean): string | undefined {
  return utms.find((utm) => (exato ? valor === utm : valor.includes(utm)))
}

/** Aplica o cálculo pra um dia — opcionalmente recebe o divisor de UTMs compartilhadas (ver
 * contarFunisPorUtm) pra dividir registros/FTDs quando a UTM que bateu também está configurada em
 * outro(s) funil(is)/config(s). Sem o parâmetro (undefined), divisor sempre 1 — comportamento
 * idêntico ao de antes dessa função existir. */
export function calcularResultadoLinhaNoDia(
  cfg: { tags?: string[]; utm?: string | null; utmsExtras?: string[] },
  dia: ResultadoDia,
  funisPorUtm?: Map<string, number>,
): ResultadoLinhaDia {
  const utms = utmsDoFluxo(cfg)
  let registros = 0
  let ftds = 0
  for (const item of dia.superbetEvents) {
    const utmCasada = utmQueCasou(utms, String(item.acid), false)
    if (utmCasada) {
      const divisor = funisPorUtm?.get(utmCasada) ?? 1
      registros += (item.registrations ?? 0) / divisor
      ftds += (item.ftds ?? 0) / divisor
    }
  }
  for (const item of dia.betmgmEvents) {
    const utmCasada = utmQueCasou(utms, String(item.marketing_source_id), true)
    if (utmCasada) {
      const divisor = funisPorUtm?.get(utmCasada) ?? 1
      registros += (item.registrations ?? 0) / divisor
      ftds += (item.ftds ?? 0) / divisor
    }
  }
  const tagEntrada = tagDeEntradaDoFluxo(cfg.tags)
  const leads = tagEntrada ? (dia.leadsPorTag[tagEntrada] ?? 0) : 0
  const convFtd = leads > 0 ? (ftds / leads) * 100 : null
  const convReg = leads > 0 ? (registros / leads) * 100 : null
  return { leads, registros, ftds, convFtd, convReg }
}

/** Arredonda um grupo de valores fracionários (ex: registros/FTDs já divididos por funil, ver
 * trackingPorFunil) preservando a soma total — arredondar cada um isoladamente (Math.round) pode
 * fazer a soma "vazar": 1.5 + 1.5 = 3, mas Math.round(1.5) + Math.round(1.5) = 4. Método do maior
 * resto: arredonda todo mundo pra baixo, depois dá +1 pros valores com maior parte fracionária até
 * bater com round(total) — exatamente o que o usuário pediu ("se o número for dar quebrado, pode
 * balancear e deixar um a mais pra um dos funis sem problema"), sem nunca estourar o total real. */
export function arredondarPreservandoTotal(valores: Record<string, number>): Record<string, number> {
  const entradas = Object.entries(valores)
  const totalArredondado = Math.round(entradas.reduce((soma, [, v]) => soma + v, 0))
  const pisos = entradas.map(([chave, v]) => [chave, Math.floor(v), v - Math.floor(v)] as const)
  const resultado: Record<string, number> = {}
  for (const [chave, piso] of pisos) resultado[chave] = piso
  let restante = totalArredondado - pisos.reduce((soma, [, piso]) => soma + piso, 0)
  const porMaiorResto = [...pisos].sort((a, b) => b[2] - a[2])
  for (let i = 0; i < porMaiorResto.length && restante > 0; i++, restante--) {
    resultado[porMaiorResto[i][0]] += 1
  }
  return resultado
}

/** Como arredondarPreservandoTotal, mas primeiro separa as entradas em grupos (union-find) conforme
 * quais UTMs cada uma referencia, e reconcilia o total DENTRO de cada grupo separadamente — chamar
 * arredondarPreservandoTotal direto no conjunto inteiro da tela (ex: as 80+ linhas de /funis)
 * preserva a soma geral, mas pode "vazar" o resto de arredondamento pra um funil sem nenhuma relação
 * com a UTM compartilhada que gerou a fração, em vez de mantê-lo entre os funis que de fato dividem
 * aquele tráfego. `utmsPorEntrada` é a lista de UTMs (utmsDoFluxo) que cada entrada referencia —
 * entradas que compartilham qualquer UTM caem no mesmo grupo (transitivamente). */
export function arredondarPreservandoTotalPorGrupo(
  valores: Record<string, number>,
  utmsPorEntrada: Record<string, string[]>,
): Record<string, number> {
  const pai = new Map<string, string>()
  function raiz(x: string): string {
    if (!pai.has(x)) pai.set(x, x)
    let r = x
    while (pai.get(r) !== r) r = pai.get(r)!
    pai.set(x, r)
    return r
  }
  function unir(a: string, b: string) {
    const ra = raiz(a)
    const rb = raiz(b)
    if (ra !== rb) pai.set(ra, rb)
  }
  const chaves = Object.keys(valores)
  for (const k of chaves) raiz(k)
  const donoDaUtm = new Map<string, string>()
  for (const k of chaves) {
    for (const utm of utmsPorEntrada[k] ?? []) {
      if (donoDaUtm.has(utm)) unir(k, donoDaUtm.get(utm)!)
      else donoDaUtm.set(utm, k)
    }
  }
  const grupos = new Map<string, string[]>()
  for (const k of chaves) {
    const r = raiz(k)
    if (!grupos.has(r)) grupos.set(r, [])
    grupos.get(r)!.push(k)
  }
  const resultado: Record<string, number> = {}
  for (const membros of grupos.values()) {
    const sub: Record<string, number> = {}
    for (const m of membros) sub[m] = valores[m]
    Object.assign(resultado, arredondarPreservandoTotal(sub))
  }
  return resultado
}

/** Quantos FUNIS distintos (do sistema inteiro, deduplicados por nome — não por config bruto)
 * referenciam cada UTM/PID. Conta por nome de propósito: o mesmo funil às vezes tem mais de um
 * config/bot (número antigo e novo, WhatsApp e Telegram) reaproveitando a UTM idêntica — se
 * contasse por config, o divisor ficaria maior que o número real de funis distintos disputando
 * aquele tráfego, sub-atribuindo o resultado a cada um. Configs sem `funil` não contam (não têm
 * como competir por nada). */
export function contarFunisPorUtm(configs: { funil?: string | null; utm?: string | null; utmsExtras?: string[] }[]): Map<string, number> {
  const porUtm = new Map<string, Set<string>>()
  for (const c of configs) {
    if (!c.funil) continue
    for (const utm of utmsDoFluxo(c)) {
      if (!porUtm.has(utm)) porUtm.set(utm, new Set())
      porUtm.get(utm)!.add(c.funil)
    }
  }
  return new Map([...porUtm.entries()].map(([utm, funis]) => [utm, funis.size]))
}

/** Quantos FUNIS distintos (do sistema inteiro, deduplicados por nome, não por config bruto) têm
 * cada campanha do Meta atribuída — mesmo princípio de contarFunisPorUtm: um funil pode ter mais
 * de um config/bot com a mesma campanha marcada em "Atribuir campanhas", e contar por config
 * infla o divisor além do número real de funis competindo pelo gasto. */
export function contarFunisPorCampanha(linhas: { funil?: string | null; campanhasMeta?: string[] }[]): Map<string, number> {
  const porCampanha = new Map<string, Set<string>>()
  for (const linha of linhas) {
    if (!linha.funil) continue
    for (const nome of linha.campanhasMeta ?? []) {
      if (!porCampanha.has(nome)) porCampanha.set(nome, new Set())
      porCampanha.get(nome)!.add(linha.funil)
    }
  }
  return new Map([...porCampanha.entries()].map(([nome, funis]) => [nome, funis.size]))
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
