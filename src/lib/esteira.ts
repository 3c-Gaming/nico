import type { Disparo, Esteira, CasaAposta, EsteiraEtapaConfig, EsteiraEtapa } from '@/types'
import { adicionarDias } from './datas'
import { gerarNomenclatura } from './nomenclatura'

export const DEFAULT_CONFIGS: EsteiraEtapaConfig[] = [
  { tipo: 'D1', casaId: '', offsetDias: 0 },
  { tipo: 'D3', casaId: '', offsetDias: 2 },
  { tipo: 'D5', casaId: '', offsetDias: 4 },
  { tipo: 'D7', casaId: '', offsetDias: 6 },
]

function detectCasaPadrao(tipo: string, casasAposta: CasaAposta[]): string | undefined {
  const mapa: Record<string, string> = {
    D1: 'superbet',
    D3: 'betmgm',
    D5: 'superbet',
  }
  const slug = mapa[tipo]
  if (!slug) return undefined
  return casasAposta.find((c) =>
    c.slug.toLowerCase().includes(slug.toLowerCase()),
  )?.id
}

export function calcularDataFilho(dataD1: Date, offsetDias: number): Date {
  return adicionarDias(dataD1, offsetDias)
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

export function criarEsteira(
  disparoD1: Disparo,
  casasAposta: CasaAposta[],
  etapaConfigs?: EsteiraEtapaConfig[],
): { esteira: Esteira; filhos: Disparo[] } {
  const configs = (etapaConfigs && etapaConfigs.length > 0) ? etapaConfigs : DEFAULT_CONFIGS
  const dataCriacao = new Date(disparoD1.criadoEm)
  const dataD1 = parseData(disparoD1.dataDisparo)

  const esteiraId = crypto.randomUUID()

  // D1 is the first non-filho config (offset === 0)
  const d1Config = configs.find((c) => c.offsetDias === 0) ?? configs[0]
  const filhoConfigs = configs.filter((c) => c.tipo !== d1Config.tipo)

  const filhos: Disparo[] = filhoConfigs.map((cfg) => {
    const dataFilho = calcularDataFilho(dataD1, cfg.offsetDias)
    const casasFilho = cfg.casaId ? [cfg.casaId] : []
    return {
      id: crypto.randomUUID(),
      tipo: cfg.tipo as any,
      nomenclatura: gerarNomenclatura({
        dataCriacao,
        tipoDisparo: cfg.tipo as any,
        dataDisparo: dataFilho,
        casas: casasAposta.filter((c) => casasFilho.includes(c.id)),
      }),
      status: 'rascunho' as const,
      casasAposta: casasFilho,
      dataDisparo: formatISODate(dataFilho),
      horarioDisparo: disparoD1.horarioDisparo,
      base: { ...disparoD1.base },
      numeroSendpulse: undefined,
      numerosSendpulse: undefined,
      esteiraPaiId: esteiraId,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    }
  })

  const etapas: EsteiraEtapa[] = [
    { tipo: d1Config.tipo, disparoId: disparoD1.id },
    ...filhos.map((f) => ({ tipo: f.tipo, disparoId: f.id })),
  ]

  const casasUnicas = [...new Set([
    ...disparoD1.casasAposta,
    ...filhos.flatMap((f) => f.casasAposta),
  ])]

  const esteira: Esteira = {
    id: esteiraId,
    nome: disparoD1.nomenclatura,
    casasAposta: casasUnicas,
    disparos: {
      d1: disparoD1.id,
      d3: filhos.find((f) => f.tipo === 'D3')?.id,
      d5: filhos.find((f) => f.tipo === 'D5')?.id,
      d7: filhos.find((f) => f.tipo === 'D7')?.id,
    },
    etapas,
    criadaEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ativa: true,
  }

  return { esteira, filhos }
}
