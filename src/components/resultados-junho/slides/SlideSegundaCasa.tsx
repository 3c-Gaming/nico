'use client'

import type { ItemSegundaCasa } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { CORES_CASA, formatarMoeda, formatarNumero } from '../formato'

function TabelaSegundaCasa({ itens }: { itens: ItemSegundaCasa[] }) {
  const totalRegistros = itens.reduce((sum, item) => sum + item.registros, 0)
  const totalFtd = itens.reduce((sum, item) => sum + item.ftd, 0)
  const totalCpas = itens.reduce((sum, item) => sum + item.cpas, 0)
  const totalFaturamento = itens.reduce((sum, item) => sum + item.faturamento, 0)

  return (
    <div className="overflow-x-auto w-full">
      <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] overflow-hidden">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-[var(--glass-border)]">
            <tr>
              <th className="px-4 py-3 text-[var(--text-primary)]">Casa</th>
              <th className="px-4 py-3 text-[var(--text-primary)]">REG</th>
              <th className="px-4 py-3 text-[var(--text-primary)]">FTDs</th>
              <th className="px-4 py-3 text-[var(--text-primary)]">CPAs</th>
              <th className="px-4 py-3 text-[var(--text-primary)]">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.casa} className="border-t border-[var(--glass-border)]">
                <td className="px-4 py-3 font-semibold" style={{ color: CORES_CASA[item.casa] ?? 'var(--d1)' }}>
                  {item.casa}
                </td>
                <td className="px-4 py-3">{formatarNumero(item.registros)}</td>
                <td className="px-4 py-3">{formatarNumero(item.ftd)}</td>
                <td className="px-4 py-3">{formatarNumero(item.cpas)}</td>
                <td className="px-4 py-3 text-green-500 font-bold">{formatarMoeda(item.faturamento)}</td>
              </tr>
            ))}
            <tr className="border-t border-[var(--glass-border)] bg-[var(--glass-border)] font-semibold">
              <td className="px-4 py-3">TOTAL</td>
              <td className="px-4 py-3">{formatarNumero(totalRegistros)}</td>
              <td className="px-4 py-3">{formatarNumero(totalFtd)}</td>
              <td className="px-4 py-3">{formatarNumero(totalCpas)}</td>
              <td className="px-4 py-3 text-green-500">{formatarMoeda(totalFaturamento)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SlideSegundaCasa({ itens }: { itens: ItemSegundaCasa[] }) {
  const totalFaturamento = itens.reduce((s, d) => s + d.faturamento, 0)

  return (
    <SlideShell
      eyebrow="LTV e Impulsionamento"
      titulo="Oferta de Segunda Casa"
      subtitulo="Faturamento da base total dos disparos que ou já tinham cadastro ou aproveitaram além da oferta do disparo padrão uma oferta complementar em outra casa — sem custo de disparo próprio, potencializando o LTV."
    >
      <SlideItem className="w-full">
        <TabelaSegundaCasa itens={itens} />
      </SlideItem>

      <SlideItem className="w-full">
        <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3 text-sm text-primary text-center">
          <b className="font-bold text-success">{formatarMoeda(totalFaturamento)}</b> de faturamento total do período como segunda casa ao longo de 35 disparos diferentes.
        </div>
      </SlideItem>
    </SlideShell>
  )
}
