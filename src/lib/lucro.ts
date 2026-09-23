import type { CasaAposta } from '@/types'

export type CasaDeTracking = 'superbet' | 'betmgm'

/**
 * Valores padrão de crédito por FTD por casa.
 *
 * O valor do funil continua sendo um override: `FlowTagConfig.lucroFtdPorCasa`
 * tem prioridade porque uma campanha pode ter uma condição comercial diferente.
 * O padrão evita que um funil Telegram recém-configurado fique sem lucro apenas
 * porque ninguém preencheu novamente o mesmo valor que já é válido para a casa.
 */
export const LUCRO_FTD_PADRAO_POR_CASA: Partial<Record<CasaDeTracking, number>> = {
  superbet: 680,
}

function normalizarNome(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Identifica a casa pelo nome/slug sem depender do ID interno do cadastro. */
export function chaveCasaDeTracking(
  casa: Pick<CasaAposta, 'nome' | 'slug'> | null | undefined,
): CasaDeTracking | null {
  const texto = normalizarNome(`${casa?.nome ?? ''} ${casa?.slug ?? ''}`)
  if (texto.includes('superbet')) return 'superbet'
  if (texto.includes('betmgm')) return 'betmgm'
  return null
}

/** Fallback para callers que ainda só conhecem o slug do tracking (ex.: Black Sender). */
function chaveCasaPorSlug(slug: string): CasaDeTracking | null {
  const texto = normalizarNome(slug)
  if (texto === 'superbet') return 'superbet'
  if (texto === 'betmgm') return 'betmgm'
  return null
}

/** Valor padrão de uma casa, ou null quando não existe uma regra configurada. */
export function lucroFtdPadraoDaCasa(
  casa: Pick<CasaAposta, 'nome' | 'slug'> | null | undefined,
): number | null {
  const chave = chaveCasaDeTracking(casa)
  return chave ? LUCRO_FTD_PADRAO_POR_CASA[chave] ?? null : null
}

/**
 * Resolve o lucro/FTD efetivo de uma casa.
 * O valor explícito do funil vence o padrão, inclusive quando ele é 0.
 */
export function resolverLucroFtdDaCasa(
  casaId: string,
  lucroPorCasa: Record<string, number> | null | undefined,
  casa: Pick<CasaAposta, 'nome' | 'slug'> | null | undefined,
): number | null {
  const explicito = lucroPorCasa?.[casaId]
  if (typeof explicito === 'number' && Number.isFinite(explicito)) return explicito
  const padrao = lucroFtdPadraoDaCasa(casa)
  if (padrao !== null) return padrao
  const chavePorSlug = chaveCasaPorSlug(casaId)
  return chavePorSlug ? LUCRO_FTD_PADRAO_POR_CASA[chavePorSlug] ?? null : null
}
