'use client'

import { ArrowRight } from 'lucide-react'
import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'

interface SlideProximosPassosProps {
  dados: ResultadosJunho2026
  topicos?: TopicosResultado
}

export function SlideProximosPassos({ dados, topicos }: SlideProximosPassosProps) {
  const casas = Object.entries(dados.porCasa).sort((a, b) => b[1].lucro - a[1].lucro)
  // casa com volume de disparos mais parecido com a lider — comparação mais justa que so "menor lucro"
  const [casaComparavel] = [...casas].slice(1).sort((a, b) => b[1].disparos - a[1].disparos)[0]

  const passosSugeridos = [
    `Revisar oferta e segmentação da base ${casaComparavel}, que ficou bem abaixo apesar de volume de disparos parecido com a líder.`,
    'Testar reduzir a intensidade de disparo em D5/D7 ou trocar a oferta nesse estágio do ciclo — conversão despenca depois do D3.',
    'Mapear o que fez os disparos de base total performarem tão bem e replicar o padrão com mais frequência.',
    'Investigar a fundo o(s) dia(s) que fecharam no vermelho antes do próximo ciclo.',
  ]

  const passos = topicos?.proximosPassos?.length ? topicos.proximosPassos : passosSugeridos

  return (
    <SlideShell eyebrow="Olhando pra frente" titulo="Próximos passos" subtitulo="Ideias/Sugestões que podemos tirar dos dados apresentados.">
      <SlideItem className="w-full flex flex-col gap-3 text-left">
        {passos.map((texto, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-sm text-[var(--text-secondary)]"
          >
            <ArrowRight size={16} className="mt-0.5 shrink-0 text-[var(--d1)]" />
            {texto}
          </div>
        ))}
      </SlideItem>
    </SlideShell>
  )
}
