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

    // Segunda trava contra o mesmo bug do scraper (leitura prematura de "R$ 0,00" antes do fetch
    // assíncrono terminar): se a edição não mudou e o valor já salvo era > 0, um resultado zerado
    // agora é muito mais provável ser leitura falha do que a edição ter zerado sozinha (vendas só
    // crescem dentro de uma edição). Não sobrescreve — mantém o dado bom e reporta falha, pro
    // botão manual ou o próximo cron tentarem de novo.
    const mesmaEdicao = resultado.edicaoId === config.edicaoId
    const zerouSuspeito = resultado.receitaVendas === 0 && resultado.quantidadeCompras === 0
    const tinhaDadoBom = (config.receitaVendas ?? 0) > 0 || (config.quantidadeCompras ?? 0) > 0
    if (mesmaEdicao && zerouSuspeito && tinhaDadoBom) {
      return { painel, ok: false, erro: 'Leitura zerada suspeita (edição igual, dado anterior positivo) — não sobrescrito' }
    }

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
