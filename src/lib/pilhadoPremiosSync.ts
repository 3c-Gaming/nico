import { buscarVendasPorDia } from '@/lib/integrações/h2premios'
import { contaBridgeDoPainel } from '@/lib/pilhadoPremios'
import { listarDisparosPilhado, atualizarDisparoPilhado } from '@/lib/db/supabase'

export interface ResultadoSyncPainel {
  painel: string
  ok: boolean
  atualizados: number
  erro?: string
}

/** Sincroniza vendas/faturamento de todos os disparos de um painel a partir de `desde`
 * (YYYY-MM-DD) — um único scrape do painel cobre o período todo. Usado tanto pelo botão manual
 * quanto pelo cron horário, pra não duplicar a lógica de matching entre os dois. */
export async function sincronizarPainelDesde(painel: string, desde: string): Promise<ResultadoSyncPainel> {
  const conta = contaBridgeDoPainel(painel)
  if (!conta) return { painel, ok: false, atualizados: 0, erro: `Painel "${painel}" não reconhecido` }

  try {
    const porDia = await buscarVendasPorDia(conta, desde)
    const todos = await listarDisparosPilhado()
    const alvo = todos.filter((d) => d.painel === painel && d.data >= desde)

    let atualizados = 0
    for (const disparo of alvo) {
      const doDia = porDia[disparo.data] ?? { vendas: 0, faturamento: 0 }
      await atualizarDisparoPilhado(disparo.id, { vendas: doDia.vendas, faturamento: doDia.faturamento })
      atualizados++
    }
    return { painel, ok: true, atualizados }
  } catch (err) {
    return { painel, ok: false, atualizados: 0, erro: (err as Error).message }
  }
}
