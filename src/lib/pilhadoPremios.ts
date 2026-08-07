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
