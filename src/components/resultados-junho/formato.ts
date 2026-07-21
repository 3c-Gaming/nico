export function formatarMoeda(v: number, decimais = 0): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  })
}

export function formatarNumero(v: number, decimais = 0): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais })
}

export function formatarPercentual(v: number, decimais = 1): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais })}%`
}

export const CORES_CICLO: Record<string, string> = {
  D1: 'var(--d1)',
  D3: 'var(--d3)',
  D5: 'var(--d5)',
  D7: 'var(--d7)',
  TOTAL: 'var(--pontual)',
}

export const CORES_CASA: Record<string, string> = {
  MGM: '#db9209',
  SuperBet: '#c8102e',
  KingPanda: '#8b5cf6',
}
