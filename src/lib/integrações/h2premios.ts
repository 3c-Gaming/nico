import { getOrFetch } from '@/lib/cache'
import type { ContaBridgeH2Premios } from '@/lib/pilhadoPremios'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

export interface VendaDia {
  vendas: number
  faturamento: number
}

export type VendasPorDia = Record<string, VendaDia>

// Vendas continuam batendo por dias depois do disparo (pagamento pendente finalizando, cliente
// comprando de novo pelo mesmo link) — por isso o dia "de hoje" nunca é definitivo. TTL curto
// mesmo pra datas passadas recentes, pra não deixar o número parado.
const TTL_MS = 30 * 60 * 1000
const DIAS_JANELA = 14

/** Busca (com cache) o mapa de vendas/faturamento por dia de uma conta h2premios — um único
 * scrape cobre toda a janela de dias de uma vez (a fonte é a lista de compras paginada, não um
 * filtro de data por chamada), então isso é compartilhado entre o botão de sync manual e o cron. */
export async function buscarVendasPorDia(conta: ContaBridgeH2Premios): Promise<VendasPorDia> {
  return getOrFetch('h2premios-vendas-por-dia', conta, TTL_MS, async () => {
    const res = await fetch(`${BRIDGE_URL}/h2premios/vendas-por-dia?conta=${conta}&dias=${DIAS_JANELA}`, {
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `bridge error ${res.status}`)
    const json = await res.json()
    return (json.porDia ?? {}) as VendasPorDia
  })
}
