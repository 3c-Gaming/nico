'use client'

import type { ResultadosJunho2026 } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { BarraComparativa } from '../BarraComparativa'
import { StatTile } from '../StatTile'
import { CORES_CICLO, formatarMoeda } from '../formato'

export function SlideCiclo({ dados }: { dados: ResultadosJunho2026 }) {
  const { porCiclo } = dados
  const ciclos = ['D1', 'D3', 'D5', 'D7'] as const

  const melhor = porCiclo.D1.roas
  const pior = Math.min(...ciclos.map((c) => porCiclo[c].roas))
  const razao = pior > 0 ? (melhor / pior).toFixed(1) : '—'

  const totalCiclo = ciclos.reduce(
    (acc, c) => ({
      custo: acc.custo + porCiclo[c].custo,
      faturamento: acc.faturamento + porCiclo[c].faturamento,
      lucro: acc.lucro + porCiclo[c].lucro,
    }),
    { custo: 0, faturamento: 0, lucro: 0 },
  )
  const roasCiclo = totalCiclo.custo > 0 ? totalCiclo.faturamento / totalCiclo.custo : 0

  return (
    <SlideShell
      eyebrow="Esteira Ciclo de 7 dias"
      titulo="Conversão por etapa do ciclo"
      subtitulo={`A base "quente" logo após o registro (D1) teve ROAS ${razao}x maior que o estágio mais fraco do ciclo. Impacto expressivo no reaprovamento da mesma base com novas ofertas. Leads captados hoje, convertem pelo resto da semana.`}
    >
      <SlideItem className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
        <StatTile label="Investimento" value={totalCiclo.custo} prefix="R$ " decimals={0} cor="var(--text-primary)" />
        <StatTile label="Faturamento" value={totalCiclo.faturamento} prefix="R$ " decimals={0} cor="var(--success)" delay={0.1} />
        <StatTile label="Lucro" value={totalCiclo.lucro} prefix="R$ " decimals={0} cor="var(--success)" delay={0.2} />
        <StatTile label="ROAS TOTAL" value={roasCiclo} suffix="x" decimals={2} cor="var(--success)" delay={0.3} />
      </SlideItem>

      <SlideItem className="w-full">
        <BarraComparativa
          itens={ciclos.map((c) => ({
            label: c,
            valor: porCiclo[c].roas,
            cor: CORES_CICLO[c],
            destaque: `${porCiclo[c].roas.toFixed(2)}x ROAS`,
          }))}
          formatarValor={(v) => `${v.toFixed(2)}x`}
        />
      </SlideItem>

      <SlideItem className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
        {ciclos.map((c) => (
          <div
            key={c}
            className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-left"
            style={{ borderLeft: `3px solid ${CORES_CICLO[c]}` }}
          >
            <div className="text-sm font-bold mb-2" style={{ color: CORES_CICLO[c] }}>
              {c}
            </div>
            <div className="text-xs text-[var(--text-primary)] space-y-1">
              <div>{porCiclo[c].disparos} Disparos Efetuados</div>
              <div>{formatarMoeda(porCiclo[c].lucro)} Lucro sob custo</div>
              <div>{formatarMoeda(porCiclo[c].custo)} Investido</div>
              <div>{formatarMoeda(porCiclo[c].faturamento)} Faturamento</div>
              <div className="grid grid-cols-3 gap-2 border border-[var(--glass-border)] rounded">
                <div className="p-4">
                  <b>{porCiclo[c].registros}</b>
                  <p>REG</p>
                </div>
                <div className="p-4">
                  <b>{porCiclo[c].ftd}</b>
                  <p>FTD</p>
                </div>
                <div className="p-4">
                  <b>{porCiclo[c].cpas}</b>
                  <p>CPA</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </SlideItem>
    </SlideShell>
  )
}
