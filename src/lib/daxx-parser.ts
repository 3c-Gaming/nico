import type { TipoDisparo, CasaAposta } from '@/types'

export interface CampanhaDaxxParsed {
  dataCriacao: string | null
  dataDisparo: string | null
  tipo: TipoDisparo | null
  baseNome: string | null
  esteiraKey: string | null
}

function ddmmParaIso(dd: string, mm: string): string {
  const ano = new Date().getFullYear()
  return `${ano}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function normalizarTexto(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Regra fixa do negócio: D1/D5 sempre saem pela Superbet (UTM), D3/D7 sempre pela BetMGM (PID).
 * O nome da "BASE X" na DAXX é só o rótulo do CSV escolhido por quem sobe a base — não indica a casa.
 */
const CASA_PADRAO_POR_TIPO: Record<string, 'superbet' | 'betmgm'> = {
  D1: 'superbet',
  D3: 'betmgm',
  D5: 'superbet',
  D7: 'betmgm',
}

/** Palpite inicial de casa a partir do tipo (D1/D3/D5/D7) — sempre editável pelo usuário antes de confirmar, nunca a decisão final. */
export function casaPadraoPorTipo(tipo: TipoDisparo | null, casasList: CasaAposta[]): string[] {
  if (!tipo) return []
  const nomeAlvo = CASA_PADRAO_POR_TIPO[tipo]
  if (!nomeAlvo) return []
  const casa = casasList.find((c) => c.nome.toLowerCase() === nomeAlvo)
  return casa ? [casa.id] : []
}

export function parsearNomeCampanhaDaxx(nome: string): CampanhaDaxxParsed {
  const resultado: CampanhaDaxxParsed = {
    dataCriacao: null,
    dataDisparo: null,
    tipo: null,
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

  if (resultado.tipo && resultado.dataCriacao && resultado.baseNome) {
    resultado.esteiraKey = `${resultado.dataCriacao}::${normalizarTexto(resultado.baseNome)}`
  }

  return resultado
}
