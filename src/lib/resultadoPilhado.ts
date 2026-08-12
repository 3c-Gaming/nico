import type { DisparoPilhado } from '@/types'
import { custoPorEntregueDoPainel } from './pilhadoPremios'

export interface MetricasPilhado {
  custo: number
  pctEntregues: number | null
  pctLidas: number | null
}

/**
 * Custo/% nunca são armazenados — sempre recalculados a partir de totalBase/entregues/lidas.
 * Custo = entregues × custo-por-entregue do painel — o custo por entregue não é fixo entre os 3
 * painéis (ver custoPorEntregueDoPainel em pilhadoPremios.ts). Vendas e faturamento não têm mais
 * atribuição por disparo — ver PilhadoPremiosConfig.
 */
export function calcularMetricasPilhado(disparo: DisparoPilhado): MetricasPilhado {
  const { totalBase, entregues, lidas } = disparo
  const custo = entregues * custoPorEntregueDoPainel(disparo.painel)

  return {
    custo,
    pctEntregues: totalBase > 0 ? entregues / totalBase : null,
    pctLidas: entregues > 0 ? lidas / entregues : null,
  }
}

export function formatPct(x: number | null): string {
  if (x == null) return '—'
  return `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
