import type { TipoDisparo } from '@/types'

export interface CampanhaDaxxParsed {
  dataCriacao: string | null
  dataDisparo: string | null
  tipo: TipoDisparo | null
  casaSlug: 'superbet' | 'betmgm' | null
  baseNome: string | null
  esteiraKey: string | null
}

const TIPO_CASA: Record<string, 'superbet' | 'betmgm'> = {
  D1: 'superbet',
  D3: 'betmgm',
  D5: 'superbet',
  D7: 'betmgm',
}

function ddmmParaIso(dd: string, mm: string): string {
  const ano = new Date().getFullYear()
  return `${ano}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

export function parsearNomeCampanhaDaxx(nome: string): CampanhaDaxxParsed {
  const resultado: CampanhaDaxxParsed = {
    dataCriacao: null,
    dataDisparo: null,
    tipo: null,
    casaSlug: null,
    baseNome: null,
    esteiraKey: null,
  }

  const criacaoMatch = nome.match(/\[(\d{2})\/(\d{2})\]/)
  if (criacaoMatch) {
    resultado.dataCriacao = ddmmParaIso(criacaoMatch[1], criacaoMatch[2])
  }

  const tipoMatch = nome.match(/\bD([1357])\b/)
  if (tipoMatch) {
    resultado.tipo = `D${tipoMatch[1]}` as TipoDisparo
    resultado.casaSlug = TIPO_CASA[resultado.tipo]
  }

  const baseMatch = nome.match(/BASE\s+(.+?)\s+D[1357]\b/)
  if (baseMatch) {
    resultado.baseNome = baseMatch[1].trim()
  }

  const allDates = [...nome.matchAll(/(\d{2})\/(\d{2})/g)]
  if (allDates.length >= 2 && resultado.dataCriacao) {
    const segundo = allDates[1]
    resultado.dataDisparo = ddmmParaIso(segundo[1], segundo[2])
  } else if (allDates.length === 1 && resultado.dataCriacao) {
    resultado.dataDisparo = resultado.dataCriacao
  }

  if (resultado.tipo && resultado.dataDisparo && resultado.baseNome) {
    resultado.esteiraKey = `${resultado.dataDisparo}_${resultado.baseNome}`
  }

  return resultado
}
