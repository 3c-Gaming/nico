'use client'

import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { formatarMoeda } from '../formato'

interface SlideErrosAcertosProps {
  dados: ResultadosJunho2026
  topicos?: TopicosResultado
}

export function SlideErrosAcertos({ dados, topicos }: SlideErrosAcertosProps) {
  const { totais, porCiclo, porCasa, disparos } = dados
  const casas = Object.entries(porCasa).sort((a, b) => b[1].lucro - a[1].lucro)
  const [melhorCasa, melhorCasaAgg] = casas[0]
  // casa com volume de disparos mais parecido com a lider (nao necessariamente a de menor lucro —
  // comparar lucro entre casas com volumes muito diferentes nao é uma comparação justa)
  const [casaComparavel, casaComparavelAgg] = [...casas]
    .slice(1)
    .sort((a, b) => b[1].disparos - a[1].disparos)[0]
  const pctBaseTotal = ((porCiclo.TOTAL.lucro / totais.lucro) * 100).toFixed(0)
  const diasPrejuizo = dados.porDia.filter((d) => d.lucro < 0)
  const piorDisparo = [...disparos].sort((a, b) => a.lucro - b.lucro)[0]
  const razaoCiclo = porCiclo.D5.roas > 0 ? (porCiclo.D1.roas / porCiclo.D5.roas).toFixed(1) : '—'

  const acertosSugeridos = [
    `Disparos de base total foram ${pctBaseTotal}% do lucro do mês vindo de só ${porCiclo.TOTAL.disparos} disparos.`,
    `D1 converteu com ROAS de ${porCiclo.D1.roas.toFixed(1)}x — a base "quente" logo após o registro responde muito bem.`,
    `${melhorCasa} liderou o mês com ${formatarMoeda(melhorCasaAgg.lucro)} de lucro em ${melhorCasaAgg.disparos} disparos.`,
  ]

  const pontosDeAtencaoSugeridos = [
    `D5/D7 converteram bem menos que D1/D3 — ROAS caiu ${razaoCiclo}x do D1 pro D5. Vale revisar oferta ou intensidade nesse estágio.`,
    `${diasPrejuizo.length} dias do mês fecharam no vermelho, com destaque pro disparo "${piorDisparo?.nome}" (${formatarMoeda(
      piorDisparo?.lucro ?? 0,
    )}).`,
    `${casaComparavel} ficou bem abaixo de ${melhorCasa} mesmo com volume parecido de disparos (${casaComparavelAgg.disparos} vs ${melhorCasaAgg.disparos}) — vale revisar segmentação/oferta.`,
  ]

  const acertos = topicos?.acertos?.length ? topicos.acertos : acertosSugeridos
  const pontosDeAtencao = topicos?.pontosAtencao?.length ? topicos.pontosAtencao : pontosDeAtencaoSugeridos

  return (
    <SlideShell eyebrow="Retrospectiva do setor" titulo="Erros e acertos" subtitulo="Ideias/Sugestões que podemos tirar dos dados apresentados.">
      <SlideItem className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
            <CheckCircle2 size={16} /> Acertos
          </div>
          {acertos.map((texto, i) => (
            <div key={i} className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3 text-sm text-[var(--text-secondary)]">
              {texto}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--warning)]">
            <AlertTriangle size={16} /> Pontos de atenção
          </div>
          {pontosDeAtencao.map((texto, i) => (
            <div key={i} className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3 text-sm text-[var(--text-secondary)]">
              {texto}
            </div>
          ))}
        </div>
      </SlideItem>
    </SlideShell>
  )
}
