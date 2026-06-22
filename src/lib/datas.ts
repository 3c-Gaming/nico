export function formatarData(date: Date, formato: 'DD/MM' | 'DD/MM/YYYY' | 'YYYY-MM-DD'): string {
  const dia = String(date.getDate()).padStart(2, '0')
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const ano = date.getFullYear()

  switch (formato) {
    case 'DD/MM':
      return `${dia}/${mes}`
    case 'DD/MM/YYYY':
      return `${dia}/${mes}/${ano}`
    case 'YYYY-MM-DD':
      return `${ano}-${mes}-${dia}`
  }
}

export function adicionarDias(date: Date, dias: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + dias)
  return result
}

export function isMesmaData(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isHoje(date: Date): boolean {
  return isMesmaData(date, new Date())
}

export function isFimDeSemana(date: Date): boolean {
  const dia = date.getDay()
  return dia === 0 || dia === 6
}

export function gerarRangeDias(inicio: Date, fim: Date): Date[] {
  const dias: Date[] = []
  const current = new Date(inicio)
  while (current <= fim) {
    dias.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return dias
}

export function parsearDataISO(isoString: string): Date {
  const [ano, mes, dia] = isoString.split('T')[0].split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export function formatarHorario(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const DIAS_SEMANA: Record<number, string> = {
  0: 'DOM',
  1: 'SEG',
  2: 'TER',
  3: 'QUA',
  4: 'QUI',
  5: 'SEX',
  6: 'SAB',
}

export function diaDaSemanaAbreviado(date: Date): string {
  return DIAS_SEMANA[date.getDay()]
}
