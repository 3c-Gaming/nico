import type { DisparoPilhado } from '@/types'
import { CUSTO_POR_ENTREGUE } from './resultadoDisparo'

export interface MetricasPilhado {
  custo: number
  pctEntregues: number | null
  pctLidas: number | null
  ticketMedio: number | null
  conversao: number | null
  roi: number | null
}

/**
 * Custo/%/ticket médio/conversão/ROI nunca são armazenados — sempre recalculados a partir do
 * que já está salvo (totalBase/entregues/lidas, sempre presentes; vendas/faturamento só depois
 * do painel h2premios ser sincronizado). Custo = totalBase × CUSTO_POR_ENTREGUE — confirmado
 * batendo exato com o CSV histórico do Pilhado Prêmios linha a linha (não é sobre entregues
 * aqui, é sobre a base enviada).
 */
export function calcularMetricasPilhado(disparo: DisparoPilhado): MetricasPilhado {
  const { totalBase, entregues, lidas, vendas, faturamento } = disparo
  const custo = totalBase * CUSTO_POR_ENTREGUE

  return {
    custo,
    pctEntregues: totalBase > 0 ? entregues / totalBase : null,
    pctLidas: entregues > 0 ? lidas / entregues : null,
    ticketMedio: vendas != null && vendas > 0 && faturamento != null ? faturamento / vendas : null,
    conversao: lidas > 0 && vendas != null ? vendas / lidas : null,
    roi: custo > 0 && faturamento != null ? faturamento / custo : null,
  }
}

export function formatPct(x: number | null): string {
  if (x == null) return '—'
  return `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
