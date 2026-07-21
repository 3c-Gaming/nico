'use client'

import type { ResultadosJunho2026 } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { StatTile } from '../StatTile'

export function SlideTotais({ dados }: { dados: ResultadosJunho2026 }) {
  const { totais } = dados

  return (
    <SlideShell eyebrow="Resultado do mês" titulo="Números gerais">
      <SlideItem className="grid grid-cols-2 md:grid-cols-2 gap-4 w-full">
        <StatTile label="Investido" value={totais.custo} prefix="R$ " decimals={0} cor="var(--text-primary)" tamanho="lg" />
        <StatTile label="Faturamento" value={totais.faturamento} prefix="R$ " decimals={0} cor="var(--success)" tamanho="lg" delay={0.1} />
        <StatTile label="Lucro" value={totais.lucro} prefix="R$ " decimals={0} cor="var(--success)" tamanho="lg" delay={0.2} />
        <StatTile label="ROAS" value={totais.roas} suffix="x" decimals={2} cor="var(--success)" tamanho="lg" delay={0.3} />
      </SlideItem>

      <SlideItem className="grid grid-cols-3 md:grid-cols-3 gap-3 w-full">
        <StatTile label="Disparos Criados" value={totais.disparos} />
        <StatTile label="Mensagens Entregues" value={totais.entregues} />
        <StatTile label="Mensagens Lidas" value={totais.lidas} />
        <StatTile label="Registros" value={totais.registros} />
        <StatTile label="FTDs" value={totais.ftd} />
        <StatTile label="CPAs" value={totais.cpas} />
      </SlideItem>

      <SlideItem className="text-sm text-[var(--text-muted)]">
        Custo por FTD R$ {totais.custoPorFtd.toFixed(2)} · Taxa de leitura {totais.txLidas.toFixed(1)}% · Conversão em FTD{' '}
        {totais.convFtd.toFixed(2)}%
      </SlideItem>
    </SlideShell>
  )
}
