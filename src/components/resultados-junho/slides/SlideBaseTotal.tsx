'use client'

import type { ResultadosJunho2026 } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { StatTile } from '../StatTile'
import { formatarMoeda } from '../formato'

export function SlideBaseTotal({ dados }: { dados: ResultadosJunho2026 }) {
  const total = dados.porCiclo.TOTAL
  const top3 = dados.disparos
    .filter((d) => d.ciclo === 'TOTAL')
    .sort((a, b) => b.lucro - a.lucro)
    .slice(0, 3)

  return (
    <SlideShell
      eyebrow="Destaques do mês"
      titulo="Disparos Pontuais"
      subtitulo={`${total.disparos} disparos pra base total, com promoções pontuais dos jogos da copa — foram responsáveis por ${(
        (total.lucro / dados.totais.lucro) *
        100
      ).toFixed(0)}% do lucro do mês.`}
    >
      <SlideItem className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
        <StatTile label="DISPAROS" value={total.disparos} cor="var(--text-primary)" tamanho="lg" delay={0.3} />
        <StatTile label="Mensagens Entregues" value={total.entregues} cor="var(--text-primary)" tamanho="lg" />
        <StatTile label="Investido / Custo" value={total.custo} prefix="R$ " cor="var(--text-primary)" tamanho="lg" delay={0.1} />
        <StatTile label="Faturamento Total" value={total.faturamento} prefix="R$ " cor="var(--text-primary)" tamanho="lg" delay={0.2} />
        <StatTile label="Lucro TOTAL" value={total.lucro} prefix="R$ " cor="var(--success)" tamanho="lg" delay={0.3} />
        <StatTile label="ROAS TOTAL" value={total.roas} suffix="x" decimals={2} cor="var(--success)" tamanho="lg" delay={0.3} />
      </SlideItem>

      <SlideItem className="w-full flex flex-col gap-2">
        <div className="text-sm font-semibold text-[var(--text-secondary)] text-left">Top 3 disparos do mês</div>
        <div className="grid grid-cols-1 gap-3">

          {top3.map((d, i) => (
            <div
              key={`${d.data}-${d.nome}`}
              className="flex items-center justify-start rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] px-4 py-3 text-left"
            >
              <img 
                src={`/top-disparos/top-${i + 1}.png`} alt={d.nome} width={60} height={60} 
                className='mr-4 shadow-xl border border-white/50 rounded'  
              />
              <div className="flex justify-between gap-3 min-w-0">
                <div className="text-lg font-bold text-[var(--pontual)] w-6 shrink-0">{i + 1}º</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{d.nome}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {d.data} · {d.casa}
                  </div>
                  <div className="text-sm font-bold text-[var(--success)]"> Lucro: {formatarMoeda(d.lucro)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SlideItem>
    </SlideShell>
  )
}
