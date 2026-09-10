'use client'

import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { StatTile } from '../StatTile'
import { estaOculto, gridColsAuto } from '../elementosOcultaveis'

export function SlideTotais({ dados, topicos }: { dados: ResultadosJunho2026; topicos?: TopicosResultado }) {
  const { totais } = dados
  const oculto = (chave: string) => estaOculto(topicos, chave)

  const grandes = [
    !oculto('totais.kpi.investido') && (
      <StatTile key="inv" label="Investido" value={totais.custo} prefix="R$ " decimals={0} cor="var(--text-primary)" tamanho="lg" />
    ),
    !oculto('totais.kpi.faturamento') && (
      <StatTile key="fat" label="Faturamento" value={totais.faturamento} prefix="R$ " decimals={0} cor="var(--success)" tamanho="lg" delay={0.1} />
    ),
    !oculto('totais.kpi.lucro') && (
      <StatTile key="luc" label="Lucro" value={totais.lucro} prefix="R$ " decimals={0} cor="var(--success)" tamanho="lg" delay={0.2} />
    ),
    !oculto('totais.kpi.roi') && (
      <StatTile key="roi" label="ROI" value={totais.roas} suffix="x" decimals={2} cor="var(--success)" tamanho="lg" delay={0.3} limiteVermelho={1} />
    ),
  ].filter(Boolean)

  const pequenos = [
    !oculto('totais.kpi.disparos') && <StatTile key="d" label="Disparos Criados" value={totais.disparos} />,
    !oculto('totais.kpi.entregues') && <StatTile key="e" label="Mensagens Entregues" value={totais.entregues} />,
    !oculto('totais.kpi.lidas') && <StatTile key="l" label="Mensagens Lidas" value={totais.lidas} />,
    !oculto('totais.kpi.registros') && <StatTile key="r" label="Registros" value={totais.registros} />,
    !oculto('totais.kpi.ftds') && <StatTile key="f" label="FTDs" value={totais.ftd} />,
    !oculto('totais.kpi.cpas') && <StatTile key="c" label="CPAs" value={totais.cpas} />,
  ].filter(Boolean)

  return (
    <SlideShell eyebrow="Resultado do mês" titulo="Números gerais">
      {grandes.length > 0 && (
        <SlideItem className={`grid ${gridColsAuto(grandes.length, 2)} gap-4 w-full`}>{grandes}</SlideItem>
      )}

      {pequenos.length > 0 && (
        <SlideItem className={`grid ${gridColsAuto(pequenos.length, 3)} gap-3 w-full`}>{pequenos}</SlideItem>
      )}

      {!oculto('totais.rodape') && (
        <SlideItem className="text-sm text-[var(--text-muted)]">
          Custo por FTD R$ {totais.custoPorFtd.toFixed(2)} · Taxa de leitura {totais.txLidas.toFixed(1)}% · Conversão em FTD{' '}
          {totais.convFtd.toFixed(2)}%
        </SlideItem>
      )}
    </SlideShell>
  )
}
