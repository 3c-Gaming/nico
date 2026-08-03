'use client'

import { useEffect } from 'react'
import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { SlideDeck } from './SlideDeck'
import { SlideCapa } from './slides/SlideCapa'
import { SlideTotais } from './slides/SlideTotais'
import { SlideCiclo } from './slides/SlideCiclo'
import { SlideBaseTotal } from './slides/SlideBaseTotal'
import { SlidePorCasa } from './slides/SlidePorCasa'
import { SlideRanking } from './slides/SlideRanking'
import { SlideErrosAcertos } from './slides/SlideErrosAcertos'
import { SlideProximosPassos } from './slides/SlideProximosPassos'
import { SlideFechamento } from './slides/SlideFechamento'
import { SlideSegundaCasa } from './slides/SlideSegundaCasa'
import { getFontePreset } from './fontes'
import { aplicarSegundaCasa } from '@/lib/resultados/segundaCasa'

export const TOPICOS_VAZIOS: TopicosResultado = { acertos: [], pontosAtencao: [], proximosPassos: [] }

interface ApresentacaoResultadoProps {
  titulo: string
  dados: ResultadosJunho2026
  topicos?: TopicosResultado
}

function useGoogleFont(googleFont: string | undefined) {
  useEffect(() => {
    if (!googleFont) return
    const id = `google-font-${googleFont}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${googleFont}&display=swap`
    document.head.appendChild(link)
  }, [googleFont])
}

export function ApresentacaoResultado({ titulo, dados, topicos = TOPICOS_VAZIOS }: ApresentacaoResultadoProps) {
  const fonte = getFontePreset(topicos.fonte)
  useGoogleFont(fonte.googleFont)

  // Totais/por-casa "cheios" incluindo os destaques de segunda casa (sem custo próprio).
  // Rankings e ciclos continuam só com dados.original — segunda casa não tem data/disparo.
  const dadosComSegundaCasa = aplicarSegundaCasa(dados, dados.segundaCasa)

  const slides = [
    { id: 'capa', render: () => <SlideCapa titulo={titulo} dados={dados} topicos={topicos} /> },
    { id: 'totais', render: () => <SlideTotais dados={dadosComSegundaCasa} /> },
    { id: 'ciclo', render: () => <SlideCiclo dados={dados} /> },
    { id: 'base-total', render: () => <SlideBaseTotal dados={dados} titulo={titulo} /> },
    { id: 'por-casa', render: () => <SlidePorCasa dados={dadosComSegundaCasa} /> },
    ...(dados.segundaCasa?.length ? [{ id: 'segunda-casa', render: () => <SlideSegundaCasa itens={dados.segundaCasa!} /> }] : []),
    { id: 'ranking', render: () => <SlideRanking dados={dados} /> },
    { id: 'erros-acertos', render: () => <SlideErrosAcertos dados={dados} topicos={topicos} /> },
    { id: 'proximos-passos', render: () => <SlideProximosPassos dados={dados} topicos={topicos} /> },
    { id: 'fechamento', render: () => <SlideFechamento dados={dadosComSegundaCasa} topicos={topicos} /> },
  ]

  return (
    <div className="h-full w-full" style={{ fontFamily: fonte.cssStack }}>
      <SlideDeck slides={slides} />
    </div>
  )
}
