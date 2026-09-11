import type { TopicosResultado } from '@/types'

export interface SubtituloSlideInfo {
  /** id do slide, mesmo usado em ApresentacaoResultado.tsx — chave dentro de topicos.subtitulosSlide */
  id: string
  label: string
}

/**
 * Todo slide que tem uma descrição abaixo do título (subtítulo do SlideShell) entra aqui pra
 * ficar editável na aba "Textos dos slides" do editor. Deixando em branco, o slide volta a usar
 * o texto automático gerado a partir dos dados daquele mês.
 */
export const SUBTITULOS_SLIDE: SubtituloSlideInfo[] = [
  { id: 'ciclo', label: 'Ciclo de 7 dias — "Conversão por etapa do ciclo"' },
  { id: 'base-total', label: 'Disparos Pontuais' },
  { id: 'por-casa', label: 'Resultados por casa' },
  { id: 'segunda-casa', label: 'Oferta de Segunda Casa' },
  { id: 'erros-acertos', label: 'Erros e acertos' },
  { id: 'proximos-passos', label: 'Próximos passos' },
]

/** Subtítulo customizado pra esse slide, se o usuário preencheu algo (senão undefined —
 *  quem chama cai no próprio texto automático). */
export function subtituloCustom(topicos: TopicosResultado | undefined, id: string): string | undefined {
  const v = topicos?.subtitulosSlide?.[id]
  return v?.trim() ? v : undefined
}
