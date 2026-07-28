import { formatarData } from './datas'

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
