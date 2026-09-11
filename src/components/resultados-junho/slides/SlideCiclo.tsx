'use client'

import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { BarraComparativa } from '../BarraComparativa'
import { StatTile } from '../StatTile'
import { CORES_CICLO, formatarMoeda } from '../formato'
import { subtituloCustom } from '../textosSlide'

export function SlideCiclo({ dados, topicos }: { dados: ResultadosJunho2026; topicos?: TopicosResultado }) {
  const { porCiclo } = dados
  const ciclos = ['D1', 'D3', 'D5', 'D7'] as const

  const melhor = porCiclo.D1.roas
  const pior = Math.min(...ciclos.map((c) => porCiclo[c].roas))
  const razao = pior > 0 ? (melhor / pior).toFixed(1) : '—'

  // Sem dado (só D1 ativo no mês, por exemplo) a razão vira "—x" e a frase fica sem sentido —
  // troca por um texto que se sustenta sozinho quando não dá pra comparar com as outras etapas.
  const subtituloAuto = pior > 0
    ? `A base "quente" logo após o registro (D1) teve ROI ${razao}x maior que o estágio mais fraco do ciclo. Impacto expressivo no reaproveitamento da mesma base com novas ofertas. Leads captados hoje, convertem pelo resto da semana.`
    : `A base "quente" logo após o registro (D1) foi a etapa do ciclo com melhor resposta no período, com ROI de ${melhor.toFixed(2)}x. Ainda não há disparos suficientes em D3/D5/D7 pra comparar.`
  const subtitulo = subtituloCustom(topicos, 'ciclo') ?? subtituloAuto

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
      compact
      eyebrow="Esteira Ciclo de 7 dias"
      titulo="Conversão por etapa do ciclo"
      subtitulo={subtitulo}
    >
      <SlideItem className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
        <StatTile label="Investimento" value={totalCiclo.custo} prefix="R$ " decimals={0} cor="var(--text-primary)" />
        <StatTile label="Faturamento" value={totalCiclo.faturamento} prefix="R$ " decimals={0} cor="var(--success)" delay={0.1} />
        <StatTile label="Lucro" value={totalCiclo.lucro} prefix="R$ " decimals={0} cor="var(--success)" delay={0.2} />
        <StatTile label="ROI TOTAL" value={roasCiclo} suffix="x" decimals={2} cor="var(--success)" delay={0.3} limiteVermelho={1} />
      </SlideItem>

      <SlideItem className="w-full">
        <BarraComparativa
          alturaBarra={26}
          itens={ciclos.map((c) => ({
            label: c,
            valor: porCiclo[c].roas,
            cor: CORES_CICLO[c],
            destaque: `${porCiclo[c].roas.toFixed(2)}x ROI`,
          }))}
          formatarValor={(v) => `${v.toFixed(2)}x`}
        />
      </SlideItem>

      <SlideItem className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
        {ciclos.map((c) => (
          <div
            key={c}
            className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-2 sm:p-2.5 text-left"
            style={{ borderLeft: `3px solid ${CORES_CICLO[c]}` }}
          >
            <div className="text-sm font-bold mb-1 sm:mb-1.5" style={{ color: CORES_CICLO[c] }}>
              {c}
            </div>
            <div className="text-[11px] sm:text-xs text-[var(--text-primary)] space-y-0.5">
              <div>{porCiclo[c].disparos} Disparos Efetuados</div>
              <div>{formatarMoeda(porCiclo[c].lucro)} Lucro sob custo</div>
              <div>{formatarMoeda(porCiclo[c].custo)} Investido</div>
              <div>{formatarMoeda(porCiclo[c].faturamento)} Faturamento</div>
              <div className="grid grid-cols-3 gap-1 border border-[var(--glass-border)] rounded">
                <div className="p-1 sm:p-1.5 text-center">
                  <b>{porCiclo[c].registros}</b>
                  <p>REG</p>
                </div>
                <div className="p-1 sm:p-1.5 text-center">
                  <b>{porCiclo[c].ftd}</b>
                  <p>FTD</p>
                </div>
                <div className="p-1 sm:p-1.5 text-center">
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
