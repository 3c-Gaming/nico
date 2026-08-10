import { getOrFetch } from '@/lib/cache'
import type { ContaBridgeH2Premios } from '@/lib/pilhadoPremios'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

// Uma leitura de edição é só um page load + trocar o <select> — bem mais rápido que a paginação
// de compras que isso substituiu, mas ainda generoso o bastante pra não abortar num login lento.
const TIMEOUT_MS = 60_000

export interface EdicaoH2Premios {
  id: string
  label: string
}

export interface ResultadoEdicaoH2Premios {
  edicaoId: string
  edicaoLabel: string
  receitaVendas: number
  ticketMedio: number
  quantidadeCompras: number
  clientesCaptados: number
}

/** Lista as edições disponíveis no seletor do Dashboard de uma conta h2premios — usado pro
 * usuário escolher manualmente qual está ativa (não dá pra detectar sozinho: a mais nova pode
 * estar zerada). Cache curto só pra evitar refetch duplicado ao abrir o seletor várias vezes. */
export async function listarEdicoes(conta: ContaBridgeH2Premios): Promise<EdicaoH2Premios[]> {
  return getOrFetch('h2premios-edicoes', conta, 5 * 60 * 1000, async () => {
    const res = await fetch(`${BRIDGE_URL}/h2premios/edicoes?conta=${conta}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `bridge error ${res.status}`)
    const json = await res.json()
    return (json.edicoes ?? []) as EdicaoH2Premios[]
  })
}

// Vendas continuam batendo ao longo da vida da edição — TTL curto pra não deixar o número parado.
const TTL_MS = 30 * 60 * 1000

/** Busca (com cache) os cards "Minhas vendas" (Receita de vendas, Ticket médio, Quantidade de
 * compras, Clientes captados) de uma conta h2premios pra uma edição específica. Cache por
 * (conta, edicaoId). */
export async function buscarResultadoEdicao(conta: ContaBridgeH2Premios, edicaoId: string): Promise<ResultadoEdicaoH2Premios> {
  return getOrFetch('h2premios-resultado-edicao', `${conta}:${edicaoId}`, TTL_MS, async () => {
    const res = await fetch(`${BRIDGE_URL}/h2premios/resultado-edicao?conta=${conta}&edicaoId=${edicaoId}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `bridge error ${res.status}`)
    return (await res.json()) as ResultadoEdicaoH2Premios
  })
}
