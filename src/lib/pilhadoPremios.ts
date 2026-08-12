// Constantes compartilhadas do braço "Pilhado Prêmios" — painel h2premios tem 3 contas, uma
// por pessoa, cada uma só vê "Minhas vendas" da própria conta.
export const PAINEIS_PILHADO = ['kaue@3c.gg', 'thomas.almeida@3c.gg', 'gustavo@3c.gg'] as const
export type PainelPilhado = (typeof PAINEIS_PILHADO)[number]

export type ContaBridgeH2Premios = 'kaue' | 'thomas' | 'gustavo'

const PAINEL_PARA_CONTA_BRIDGE: Record<string, ContaBridgeH2Premios> = {
  'kaue@3c.gg': 'kaue',
  'thomas.almeida@3c.gg': 'thomas',
  'gustavo@3c.gg': 'gustavo',
}

export function contaBridgeDoPainel(painel: string): ContaBridgeH2Premios | null {
  return PAINEL_PARA_CONTA_BRIDGE[painel.toLowerCase()] ?? null
}

// Custo por entregue varia por painel — confirmado com o usuário: a conta do Gustavo tem um custo
// bem maior (R$0,13) que as demais (R$0,03). Fallback em 0,03 (o valor mais comum) se algum dia
// aparecer um painel fora dos 3 conhecidos.
const CUSTO_POR_ENTREGUE_PADRAO = 0.03
const CUSTO_POR_ENTREGUE_POR_PAINEL: Record<string, number> = {
  'kaue@3c.gg': 0.03,
  'thomas.almeida@3c.gg': 0.03,
  'gustavo@3c.gg': 0.13,
}

export function custoPorEntregueDoPainel(painel: string): number {
  return CUSTO_POR_ENTREGUE_POR_PAINEL[painel.toLowerCase()] ?? CUSTO_POR_ENTREGUE_PADRAO
}
