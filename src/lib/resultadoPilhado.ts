import type { DisparoPilhado } from '@/types'
import { CUSTO_POR_ENTREGUE } from './resultadoDisparo'

export interface MetricasPilhado {
  custo: number
  pctEntregues: number | null
  pctLidas: number | null
}

/**
 * Custo/% nunca são armazenados — sempre recalculados a partir de totalBase/entregues/lidas.
 * Custo = totalBase × CUSTO_POR_ENTREGUE — confirmado batendo exato com o CSV histórico do
 * Pilhado Prêmios linha a linha (não é sobre entregues aqui, é sobre a base enviada). Vendas e
 * faturamento não têm mais atribuição por disparo — ver PilhadoPremiosConfig.
 */
export function calcularMetricasPilhado(disparo: DisparoPilhado): MetricasPilhado {
  const { totalBase, entregues, lidas } = disparo
  const custo = totalBase * CUSTO_POR_ENTREGUE

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
