// Helper client-side (sem process.env) pra contar leads por tag num intervalo de datas — a API
// da SendPulse é escopada por bot (precisa de bot_id pra cada chamada), então quem chama isso
// precisa agrupar as tags por botId antes. Centralizado aqui porque a mesma lógica se repete em
// telas diferentes (Funis, detalhe de Disparo).

export interface GrupoBotTags {
  botId: string
  tags: string[]
}

/** Agrupa tags pelo botId de origem (útil quando se tem uma lista de flowIds/rows, cada um com
 * seu próprio botId e tags configuradas). */
export function agruparTagsPorBot(itens: { botId?: string | null; tags: string[] }[]): GrupoBotTags[] {
  const mapa = new Map<string, Set<string>>()
  for (const item of itens) {
    if (!item.botId || !item.tags.length) continue
    const set = mapa.get(item.botId) ?? new Set<string>()
    for (const tag of item.tags) set.add(tag)
    mapa.set(item.botId, set)
  }
  return [...mapa.entries()].map(([botId, tags]) => ({ botId, tags: [...tags] }))
}

/** Busca a contagem de leads por tag num intervalo, uma chamada por bot (em paralelo), e devolve
 * tudo já mesclado num único mapa tag -> contagem. Uma tag que falhar fica de fora do mapa
 * (undefined), não derruba as demais. */
export async function contarLeadsIntervalo(
  grupos: GrupoBotTags[],
  dataInicio: string,
  dataFim: string,
  opts?: { refresh?: boolean },
): Promise<Record<string, number>> {
  const leads: Record<string, number> = {}
  await Promise.allSettled(
    grupos.map(async (grupo) => {
      const res = await fetch('/api/sendpulse/contagem-intervalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: grupo.botId, tags: grupo.tags, dataInicio, dataFim, refresh: opts?.refresh }),
      })
      if (!res.ok) return
      const data = await res.json()
      Object.assign(leads, data.leads ?? {})
    }),
  )
  return leads
}
