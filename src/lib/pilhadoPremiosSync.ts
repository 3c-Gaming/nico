import { buscarResultadoEdicao } from '@/lib/integrações/h2premios'
import { contaBridgeDoPainel } from '@/lib/pilhadoPremios'
import { getConfigPilhadoPremios, upsertConfigPilhadoPremios } from '@/lib/db/supabase'

export interface ResultadoSyncPainel {
  painel: string
  ok: boolean
  erro?: string
}

/** Sincroniza o resultado (Receita de vendas/Ticket médio/Quantidade de compras) de um painel,
 * usando a edição configurada manualmente pra ele (ver PilhadoPremiosConfig). Se o painel ainda
 * não tem edição configurada, não há o que sincronizar. Usado tanto pelo botão manual quanto pelo
 * cron horário. */
export async function sincronizarPainel(painel: string): Promise<ResultadoSyncPainel> {
  const conta = contaBridgeDoPainel(painel)
  if (!conta) return { painel, ok: false, erro: `Painel "${painel}" não reconhecido` }

  const config = await getConfigPilhadoPremios(painel)
  if (!config?.edicaoId) return { painel, ok: false, erro: 'Nenhuma edição configurada pra esse painel' }

  try {
    const resultado = await buscarResultadoEdicao(conta, config.edicaoId)
    await upsertConfigPilhadoPremios({
      painel,
      edicaoId: resultado.edicaoId,
      edicaoLabel: resultado.edicaoLabel,
      receitaVendas: resultado.receitaVendas,
      ticketMedio: resultado.ticketMedio,
      quantidadeCompras: resultado.quantidadeCompras,
      clientesCaptados: resultado.clientesCaptados,
      atualizadoEm: new Date().toISOString(),
    })
    return { painel, ok: true }
  } catch (err) {
    return { painel, ok: false, erro: (err as Error).message }
  }
}
