import type { TipoDisparo, CasaAposta } from '@/types'

export interface CampanhaDaxxParsed {
  dataCriacao: string | null
  dataDisparo: string | null
  /** Nunca fica null — sem D1/D3/D5/D7 no nome, cai em PONTUAL (disparo avulso, sem esteira). */
  tipo: TipoDisparo
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

function adicionarDiasIso(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Regra fixa do negócio: D1/D5 sempre saem pela Superbet (UTM), D3 sempre pela BetMGM (PID).
 * Por hora não consideramos D7 no ciclo. O nome da "BASE X" na DAXX é só o rótulo do CSV
 * escolhido por quem sobe a base — não indica a casa.
 */
const CASA_PADRAO_POR_TIPO: Record<string, 'superbet' | 'betmgm'> = {
  D1: 'superbet',
  D3: 'betmgm',
  D5: 'superbet',
}

/**
 * Deslocamento fixo (em dias) de cada etapa em relação ao D1 do mesmo ciclo — convenção
 * da própria DAXX, não a configuração ajustável do usuário em /esteiras. Usado só pra
 * calcular uma chave de ciclo estável (não pra prever data de disparo futura).
 */
const OFFSET_CICLO: Record<string, number> = { D1: 0, D3: 2, D5: 4 }

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
    tipo: 'PONTUAL',
    baseNome: null,
    esteiraKey: null,
  }

  const criacaoMatch = nome.match(/\[(\d{2})\/(\d{2})\]/)
  if (criacaoMatch) {
    resultado.dataCriacao = ddmmParaIso(criacaoMatch[1], criacaoMatch[2])
  }

  // Sem D1/D3/D5/D7 no nome: não é ciclo, então é disparo avulso/pontual (fica com o
  // default acima) — não descarta o item, só não agrupa em esteira.
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

  if (resultado.tipo && resultado.dataDisparo && resultado.baseNome) {
    const offset = OFFSET_CICLO[resultado.tipo]
    if (offset != null) {
      const ancora = adicionarDiasIso(resultado.dataDisparo, -offset)
      resultado.esteiraKey = `${ancora}::${normalizarTexto(resultado.baseNome)}`
    }
  }

  return resultado
}
