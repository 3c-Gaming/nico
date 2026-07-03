import type { Disparo, Esteira, CasaAposta } from '@/types'
import { adicionarDias } from './datas'
import { gerarNomenclatura } from './nomenclatura'

const OFFSET: Record<'D3' | 'D5' | 'D7', number> = { D3: 2, D5: 4, D7: 6 }

export function calcularDataFilho(dataD1: Date, tipo: 'D3' | 'D5' | 'D7'): Date {
  return adicionarDias(dataD1, OFFSET[tipo])
}

export function criarEsteira(disparoD1: Disparo, casasAposta: CasaAposta[]): Esteira {
  const dataCriacao = new Date(disparoD1.criadoEm)
  const dataD1 = parseData(disparoD1.dataDisparo)

  const esteiraId = crypto.randomUUID()
  const dataD3 = calcularDataFilho(dataD1, 'D3')
  const dataD5 = calcularDataFilho(dataD1, 'D5')
  const dataD7 = calcularDataFilho(dataD1, 'D7')

  const tipos: { tipo: 'D3' | 'D5' | 'D7'; data: Date }[] = [
    { tipo: 'D3', data: dataD3 },
    { tipo: 'D5', data: dataD5 },
    { tipo: 'D7', data: dataD7 },
  ]

  const filhos: Disparo[] = tipos.map(({ tipo, data }) => ({
    id: crypto.randomUUID(),
    tipo,
    nomenclatura: gerarNomenclatura({
      dataCriacao,
      tipoDisparo: tipo,
      dataDisparo: data,
      casas: casasAposta.filter((c) => disparoD1.casasAposta.includes(c.id)),
    }),
    status: 'rascunho' as const,
    casasAposta: [...disparoD1.casasAposta],
    dataDisparo: formatISODate(data),
    horarioDisparo: disparoD1.horarioDisparo,
    base: { ...disparoD1.base },
    utm: disparoD1.utm,
    betmgmPid: disparoD1.betmgmPid,
    templateDaxx: disparoD1.templateDaxx ? { ...disparoD1.templateDaxx } : undefined,
    numerosSendpulse: disparoD1.numerosSendpulse?.map((n) => ({ ...n })),
    esteiraPaiId: esteiraId,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  }))

  const esteira: Esteira = {
    id: esteiraId,
    nome: disparoD1.nomenclatura,
    casasAposta: [...disparoD1.casasAposta],
    disparos: {
      d1: disparoD1.id,
      d3: filhos[0].id,
      d5: filhos[1].id,
      d7: filhos[2].id,
    },
    criadaEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ativa: true,
  }

  return esteira
}

function parseData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function formatISODate(date: Date): string {
  const ano = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}
