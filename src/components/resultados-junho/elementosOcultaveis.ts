import type { TopicosResultado } from '@/types'

export interface ElementoOcultavel {
  grupo: string
  chave: string
  label: string
}

/**
 * Elementos de slide que o usuário pode ligar/desligar na tela de edição (aba "Ocultar
 * elementos"), sem precisar pedir a remoção manualmente. Cada slide checa `estaOculto(topicos,
 * chave)` antes de renderizar o elemento correspondente.
 */
export const ELEMENTOS_OCULTAVEIS: ElementoOcultavel[] = [
  // Slide "Números gerais" (SlideTotais)
  { grupo: 'Números gerais', chave: 'totais.kpi.investido', label: 'KPI Investido' },
  { grupo: 'Números gerais', chave: 'totais.kpi.faturamento', label: 'KPI Faturamento' },
  { grupo: 'Números gerais', chave: 'totais.kpi.lucro', label: 'KPI Lucro' },
  { grupo: 'Números gerais', chave: 'totais.kpi.roi', label: 'KPI ROI' },
  { grupo: 'Números gerais', chave: 'totais.kpi.disparos', label: 'KPI Disparos criados' },
  { grupo: 'Números gerais', chave: 'totais.kpi.entregues', label: 'KPI Mensagens entregues' },
  { grupo: 'Números gerais', chave: 'totais.kpi.lidas', label: 'KPI Mensagens lidas' },
  { grupo: 'Números gerais', chave: 'totais.kpi.registros', label: 'KPI Registros' },
  { grupo: 'Números gerais', chave: 'totais.kpi.ftds', label: 'KPI FTDs' },
  { grupo: 'Números gerais', chave: 'totais.kpi.cpas', label: 'KPI CPAs' },
  { grupo: 'Números gerais', chave: 'totais.rodape', label: 'Rodapé (custo/FTD · taxa de leitura · conversão)' },

  // Slide "Funis de WhatsApp" (SlideFunisWhatsapp)
  { grupo: 'Funis de WhatsApp', chave: 'funisWa.kpi.registros', label: 'KPI Registros' },
  { grupo: 'Funis de WhatsApp', chave: 'funisWa.kpi.ftds', label: 'KPI FTDs' },
  { grupo: 'Funis de WhatsApp', chave: 'funisWa.kpi.cpas', label: 'KPI CPAs' },
  { grupo: 'Funis de WhatsApp', chave: 'funisWa.kpi.conv', label: 'KPI Conversão' },
  { grupo: 'Funis de WhatsApp', chave: 'funisWa.barras', label: 'Gráfico de barras' },
  { grupo: 'Funis de WhatsApp', chave: 'funisWa.tabela', label: 'Tabela de funis' },

  // Slide "Resultados por casa" (SlidePorCasa)
  { grupo: 'Resultados por casa', chave: 'porCasa.barras', label: 'Barras de comparação' },
]

export function estaOculto(topicos: TopicosResultado | undefined, chave: string): boolean {
  return !!topicos?.slidesOcultos?.includes(chave)
}

/**
 * Classe de coluna de grid do Tailwind ajustada ao nº de itens realmente visíveis, pra não
 * deixar um card "órfão" na última linha quando o usuário oculta KPIs. `max` é o teto de colunas
 * daquele grid (o valor que ele usava quando cheio). Regra: 4 itens num grid de ≤3 colunas vira
 * 2×2 em vez de 3+1. As classes são string literais pro Tailwind conseguir detectá-las.
 */
export function gridColsAuto(n: number, max = 3): string {
  const alvo = n <= 1 ? 1 : n === 2 ? 2 : n === 4 && max < 4 ? 2 : Math.min(n, max)
  switch (alvo) {
    case 1:
      return 'grid-cols-1'
    case 2:
      return 'grid-cols-2'
    case 4:
      return 'grid-cols-4'
    case 5:
      return 'grid-cols-5'
    default:
      return 'grid-cols-3'
  }
}
