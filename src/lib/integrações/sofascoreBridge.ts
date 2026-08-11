import type { Jogo } from '@/types'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

/** Busca os jogos das 7 ligas acompanhadas numa data via o scraper do SofaScore no daxx-bridge —
 * substitui a API-Football, que no plano free só respondia pra hoje ± 1 dia (confirmado ao vivo).
 * O SofaScore não tem essa restrição de janela. */
export async function buscarJogosPorData(dataISO: string, signal?: AbortSignal): Promise<Jogo[]> {
  const res = await fetch(`${BRIDGE_URL}/sofascore/fixtures?date=${dataISO}`, { signal })
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || `bridge error ${res.status}`)
  const json = await res.json()
  return (json.jogos ?? []) as Jogo[]
}
