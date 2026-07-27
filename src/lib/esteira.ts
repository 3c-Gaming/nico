import type { EsteiraEtapaConfig } from '@/types'
import { adicionarDias } from './datas'

export const DEFAULT_CONFIGS: EsteiraEtapaConfig[] = [
  { tipo: 'D1', casaId: '', offsetDias: 0 },
  { tipo: 'D3', casaId: '', offsetDias: 2 },
  { tipo: 'D5', casaId: '', offsetDias: 4 },
  { tipo: 'D7', casaId: '', offsetDias: 6 },
]

export function calcularDataFilho(dataD1: Date, offsetDias: number): Date {
  return adicionarDias(dataD1, offsetDias)
}
