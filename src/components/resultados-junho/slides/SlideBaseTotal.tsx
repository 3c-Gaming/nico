'use client'

import { useState } from 'react'
import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { StatTile } from '../StatTile'
import { formatarMoeda, slugMes } from '../formato'
import { subtituloCustom } from '../textosSlide'

type DisparoTop = ResultadosJunho2026['topDisparos'][number]

// Card de disparo pontual. Quando não existe arte (imagem 404), some com o <img> e o card
// encolhe pra altura do conteúdo — sem isso o alt-text quebrava dentro de uma caixa de 44px
// e esticava o card pra ~200px de altura vazia.
function TopCard({ disparo, posicao, pasta }: { disparo: DisparoTop; posicao: number; pasta: string }) {
  const [semArte, setSemArte] = useState(false)

  return (
    <div className="flex items-center justify-start rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2 text-left">
      {!semArte && (
        <img
          src={`/top-disparos/${pasta}/top-${posicao}.png`}
          alt={disparo.nome}
          width={44}
          height={44}
          onError={() => setSemArte(true)}
          className="mr-3 h-11 w-11 object-cover shadow-xl border border-white/50 rounded shrink-0"
        />
      )}
      <div className="flex justify-between gap-3 min-w-0">
        <div className="text-lg font-bold text-[var(--pontual)] w-6 shrink-0">{posicao}º</div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{disparo.nome}</div>
          <div className="text-xs text-[var(--text-muted)]">
            {disparo.data} · {disparo.casa}
          </div>
          <div className="text-sm font-bold" style={{ color: disparo.lucro < 0 ? 'var(--error)' : 'var(--success)' }}>
            Lucro: {formatarMoeda(disparo.lucro)} · ROI {disparo.custo > 0 ? `${disparo.roas.toFixed(2)}x` : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SlideBaseTotal({ dados, titulo, topicos }: { dados: ResultadosJunho2026; titulo: string; topicos?: TopicosResultado }) {
  const total = dados.porCiclo.TOTAL
  const pastaImagens = slugMes(titulo)
  const top3 = dados.disparos
    .filter((d) => d.ciclo === 'TOTAL')
    .sort((a, b) => b.lucro - a.lucro)
    .slice(0, 3)

  const subtituloAuto = `${total.disparos} disparos pra base total, com promoções pontuais dos jogos da copa — foram responsáveis por ${(
    dados.totais.lucro !== 0 ? (total.lucro / dados.totais.lucro) * 100 : 0
  ).toFixed(0)}% do lucro do mês.`

  return (
    <SlideShell
      compact
      eyebrow="Destaques do mês"
      titulo="Disparos Pontuais"
      subtitulo={subtituloCustom(topicos, 'base-total') ?? subtituloAuto}
    >
      <SlideItem className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full">
        <StatTile label="DISPAROS" value={total.disparos} cor="var(--text-primary)" delay={0.3} />
        <StatTile label="Mensagens Entregues" value={total.entregues} cor="var(--text-primary)" />
        <StatTile label="Investido / Custo" value={total.custo} prefix="R$ " cor="var(--text-primary)" delay={0.1} />
        <StatTile label="Faturamento Total" value={total.faturamento} prefix="R$ " cor="var(--text-primary)" delay={0.2} />
        <StatTile label="Lucro TOTAL" value={total.lucro} prefix="R$ " cor="var(--success)" delay={0.3} />
        <StatTile label="ROI TOTAL" value={total.roas} suffix="x" decimals={2} cor="var(--success)" delay={0.3} limiteVermelho={1} />
      </SlideItem>

      <SlideItem className="w-full flex flex-col gap-1.5">
        <div className="text-sm font-semibold text-[var(--text-secondary)] text-left">Top 3 disparos do mês</div>
        <div className="grid grid-cols-1 gap-2">
          {top3.map((d, i) => (
            <TopCard key={`${d.data}-${d.nome}`} disparo={d} posicao={i + 1} pasta={pastaImagens} />
          ))}
        </div>
      </SlideItem>
    </SlideShell>
  )
}
