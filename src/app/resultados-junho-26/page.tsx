'use client'

import { resultadosJunho2026 } from '@/data/resultadosJunho2026'
import { SlideDeck } from '@/components/resultados-junho/SlideDeck'
import { SlideCapa } from '@/components/resultados-junho/slides/SlideCapa'
import { SlideTotais } from '@/components/resultados-junho/slides/SlideTotais'
import { SlideCiclo } from '@/components/resultados-junho/slides/SlideCiclo'
import { SlideBaseTotal } from '@/components/resultados-junho/slides/SlideBaseTotal'
import { SlidePorCasa } from '@/components/resultados-junho/slides/SlidePorCasa'
import { SlideRanking } from '@/components/resultados-junho/slides/SlideRanking'
import { SlideErrosAcertos } from '@/components/resultados-junho/slides/SlideErrosAcertos'
import { SlideProximosPassos } from '@/components/resultados-junho/slides/SlideProximosPassos'
import { SlideFechamento } from '@/components/resultados-junho/slides/SlideFechamento'

export default function ResultadosJunho26Page() {
  const dados = resultadosJunho2026

  const slides = [
    { id: 'capa', render: () => <SlideCapa dados={dados} titulo="Junho 2026" /> },
    { id: 'totais', render: () => <SlideTotais dados={dados} /> },
    { id: 'ciclo', render: () => <SlideCiclo dados={dados} /> },
    { id: 'base-total', render: () => <SlideBaseTotal dados={dados} /> },
    { id: 'por-casa', render: () => <SlidePorCasa dados={dados} /> },
    { id: 'ranking', render: () => <SlideRanking dados={dados} /> },
    { id: 'erros-acertos', render: () => <SlideErrosAcertos dados={dados} /> },
    { id: 'proximos-passos', render: () => <SlideProximosPassos dados={dados} /> },
    { id: 'fechamento', render: () => <SlideFechamento dados={dados} /> },
  ]

  return <SlideDeck slides={slides} />
}
