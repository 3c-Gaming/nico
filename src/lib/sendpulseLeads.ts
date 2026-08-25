// Helper client-side (sem process.env) pra contar leads por tag num intervalo de datas — a API
// da SendPulse é escopada por bot (precisa de bot_id pra cada chamada), então quem chama isso
// precisa agrupar as tags por botId antes. Centralizado aqui porque a mesma lógica se repete em
// telas diferentes (Funis, detalhe de Disparo).

export interface GrupoBotTags {
  botId: string
  tags: string[]
}

/** Uma mesma tag (ex: "Lead_Disp_SB_D1") costuma ser reaproveitada em fluxos diferentes —
 * frequentemente em bots/números diferentes rodando a mesma campanha. Um mapa achatado tag ->
 * contagem não sobrevive a isso: duas chamadas escopadas a bots diferentes resolvendo a mesma tag
 * fariam a que responder por último sobrescrever a outra (na prática, zerando o número certo com
 * a contagem de um bot onde aquela tag não teve lead nenhum hoje). Toda contagem por tag precisa
 * ser combinada com o botId de origem antes de entrar num mapa compartilhado. */
export function chaveTagBot(botId: string, tag: string): string {
  return `${botId}::${tag}`
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
 * (undefined), não derruba as demais. Se `onGrupoResolvido` for passado, é chamado a cada bot que
 * responder (com só as tags daquele grupo) — permite a quem chama atualizar a tela
 * progressivamente em vez de esperar todos os bots responderem pra mostrar qualquer coisa (um bot
 * lento não deveria travar a exibição dos que já responderam). */
export async function contarLeadsIntervalo(
  grupos: GrupoBotTags[],
  dataInicio: string,
  dataFim: string,
  opts?: { refresh?: boolean; onGrupoResolvido?: (botId: string, leads: Record<string, number>) => void },
): Promise<Record<string, number>> {
  const leads: Record<string, number> = {}
  await Promise.allSettled(
    grupos.map(async (grupo) => {
      const res = await fetch('/api/sendpulse/contagem-intervalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: grupo.botId, tags: grupo.tags, dataInicio, dataFim, refresh: opts?.refresh }),
      })
      if (!res.ok) { opts?.onGrupoResolvido?.(grupo.botId, {}); return }
      const data = await res.json()
      // Rechaveia tag -> "botId::tag" antes de mesclar no mapa compartilhado, ver chaveTagBot.
      const comChave: Record<string, number> = {}
      for (const [tag, valor] of Object.entries(data.leads ?? {})) {
        comChave[chaveTagBot(grupo.botId, tag)] = valor as number
      }
      Object.assign(leads, comChave)
      opts?.onGrupoResolvido?.(grupo.botId, comChave)
    }),
  )
  return leads
}
