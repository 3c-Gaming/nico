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
// Scrape de um mês inteiro pode demorar bem mais que os 14 dias fixos de antes — generoso aqui
// pra não abortar antes da hora (mas menor que o maxDuration das rotas que chamam isso, pra
// devolver um erro nosso em vez de a Vercel matar a função sem explicação).
const TIMEOUT_MS = 200_000

/** Busca (com cache) o mapa de vendas/faturamento por dia de uma conta h2premios, desde `desde`
 * (YYYY-MM-DD, normalmente o primeiro dia do mês visível na tela) até hoje — um único scrape cobre
 * o período todo de uma vez (a fonte é a lista de compras paginada, não um filtro de data por
 * chamada), então isso é compartilhado entre o botão de sync manual e o cron. Cache por
 * (conta, desde) — meses diferentes não pisam um no cache do outro. */
export async function buscarVendasPorDia(conta: ContaBridgeH2Premios, desde: string): Promise<VendasPorDia> {
  return getOrFetch('h2premios-vendas-por-dia', `${conta}:${desde}`, TTL_MS, async () => {
    const res = await fetch(`${BRIDGE_URL}/h2premios/vendas-por-dia?conta=${conta}&desde=${desde}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `bridge error ${res.status}`)
    const json = await res.json()
    return (json.porDia ?? {}) as VendasPorDia
  })
}
