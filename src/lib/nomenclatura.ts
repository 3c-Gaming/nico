import type { CasaAposta, TipoDisparo } from '@/types'
import { formatarData } from './datas'

function gerarSigla(nome: string): string {
  return nome
    .split(/(?=[A-Z])|[\s-]+/)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
    .slice(0, 4)
}

export function gerarNomenclatura(params: {
  dataCriacao: Date
  tipoDisparo: TipoDisparo
  dataDisparo: Date
  casas: CasaAposta[]
  sufixo?: string
}): string {
  const { dataCriacao, tipoDisparo, dataDisparo, casas, sufixo } = params
  const siglas = casas.map((c) => gerarSigla(c.nome)).join('+')
  const base = `[${formatarData(dataCriacao, 'DD/MM')}] ${tipoDisparo} ${formatarData(dataDisparo, 'DD/MM')} BASE ${siglas}`
  return sufixo ? `${base} ${sufixo}` : base
}
