import { formatarData, gerarRangeDias, parsearDataISO } from './datas'

export const CUSTO_POR_ENTREGUE = 0.13

/** Valor de cada CPA (R$), fixo por casa: Superbet paga R$500/CPA, BetMGM paga R$260/CPA. */
export const VALOR_CPA: Record<'superbet' | 'betmgm', number> = {
  superbet: 500,
  betmgm: 260,
}

export function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function formatMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatRoi(x: number): string {
  return `${x.toFixed(x % 1 === 0 ? 0 : 1)}x`
}

/** Corta o prefixo padrão da DAXX ("[dd/mm] DISP TOTAL dd/mm BASE ") e deixa só o rótulo da base. */
export function nomeCurto(nome: string): string {
  const cortado = nome.replace(/^\[\d{2}\/\d{2}\]\s*DISP\s+TOTAL\s+\d{2}\/\d{2}\s+BASE\s+/i, '').trim()
  return cortado || nome
}

export interface ResultadoUtm {
  registros: number
  ftds: number
  cpas: number | null
}

/**
 * Busca registros/FTDs (e CPAs, quando o dia já fechou) pra uma UTM/PID+casa+data.
 * Hoje/futuro ainda não tem CPA na fonte de CPA — usa o endpoint só com registros/FTDs
 * até o dia fechar, depois passa a usar o endpoint completo (com CPA).
 */
export async function buscarResultadoUtm(
  utmValor: string,
  casa: 'superbet' | 'betmgm',
  data: string,
): Promise<ResultadoUtm | null> {
  const dataAindaNaoFechou = data >= formatarData(new Date(), 'YYYY-MM-DD')
  const url = dataAindaNaoFechou
    ? `/api/tracking/export/utm?utm=${encodeURIComponent(utmValor)}&casa=${casa}&date=${encodeURIComponent(data)}`
    : `/api/campanhas/relatorio/utm?utm=${encodeURIComponent(utmValor)}&casa=${casa}&date=${encodeURIComponent(data)}`

  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  return {
    registros: json.registros ?? 0,
    ftds: json.ftds ?? 0,
    cpas: dataAindaNaoFechou ? null : (json.cpas ?? 0),
  }
}

/**
 * Mesma coisa que buscarResultadoUtm, mas somado num período (dataInicio..dataFim, inclusive).
 * As fontes de dados (tracking/campanhas) só respondem por dia — aqui busca dia a dia em
 * paralelo e soma. Se algum dia do período ainda não fechou (hoje ou futuro), CPA do período
 * inteiro fica null — mesma regra do dia único, só que agora "período" só pode ter CPA final
 * quando todo mundo dentro dele já fechou.
 */
export async function buscarResultadoUtmPeriodo(
  utmValor: string,
  casa: 'superbet' | 'betmgm',
  dataInicio: string,
  dataFim: string,
): Promise<ResultadoUtm | null> {
  const datas = gerarRangeDias(parsearDataISO(dataInicio), parsearDataISO(dataFim)).map((d) => formatarData(d, 'YYYY-MM-DD'))
  const resultados = await Promise.all(datas.map((data) => buscarResultadoUtm(utmValor, casa, data)))
  const validos = resultados.filter((r): r is ResultadoUtm => r != null)
  if (validos.length === 0) return null

  const algumAindaAberto = validos.some((r) => r.cpas == null)
  return {
    registros: validos.reduce((soma, r) => soma + r.registros, 0),
    ftds: validos.reduce((soma, r) => soma + r.ftds, 0),
    cpas: algumAindaAberto ? null : validos.reduce((soma, r) => soma + (r.cpas ?? 0), 0),
  }
}
