'use client'

import { useMemo, useState } from 'react'
import type { FunisWhatsappDados, TopicosResultado } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { BarraComparativa } from '../BarraComparativa'
import { formatarNumero, formatarPercentual, CORES_CASA } from '../formato'
import { estaOculto, gridColsAuto } from '../elementosOcultaveis'

const CORES = ['var(--d1)', 'var(--d3)', 'var(--d5)', 'var(--d7)', 'var(--pontual)']
const TOP_N = 8

interface LinhaCalc {
  funil: string
  registros: number
  ftds: number
  cpas: number
  conv: number | null
}

function linhasPorModo(dados: FunisWhatsappDados, casa: string, site: string): LinhaCalc[] {
  return dados.itens
    .map((it) => {
      let registros = 0
      let ftds = 0
      let cpas = 0
      for (const cel of it.celulas) {
        if (casa !== 'todas' && cel.casa !== casa) continue
        if (site !== 'total' && cel.siteId !== site) continue
        registros += cel.registros
        ftds += cel.ftds
        cpas += cel.cpas
      }
      return { funil: it.funil, registros, ftds, cpas, conv: registros > 0 ? (ftds / registros) * 100 : null }
    })
    .filter((l) => l.registros > 0 || l.ftds > 0 || l.cpas > 0)
    .sort((a, b) => b.ftds - a.ftds || b.registros - a.registros)
}

function Pills({ opcoes, valor, onChange }: {
  opcoes: { id: string; nome: string; sub?: string }[]
  valor: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {opcoes.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            valor === o.id
              ? 'bg-[var(--d1)] text-white border-[var(--d1)]'
              : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:text-[var(--text-primary)]'
          }`}
        >
          {o.nome}
          {o.sub && <span className="ml-1.5 opacity-70">{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

export function SlideFunisWhatsapp({ dados, topicos }: { dados: FunisWhatsappDados; topicos?: TopicosResultado }) {
  const [modoCasa, setModoCasa] = useState('todas')
  const [modoSite, setModoSite] = useState('total')
  const oculto = (chave: string) => estaOculto(topicos, chave)

  const temCasas = dados.casas.length > 1
  const linhas = useMemo(() => linhasPorModo(dados, modoCasa, modoSite), [dados, modoCasa, modoSite])

  const totalReg = linhas.reduce((s, l) => s + l.registros, 0)
  const totalFtd = linhas.reduce((s, l) => s + l.ftds, 0)
  const totalCpa = linhas.reduce((s, l) => s + l.cpas, 0)
  const convGeral = totalReg > 0 ? (totalFtd / totalReg) * 100 : 0

  const top = linhas.slice(0, TOP_N)
  const resto = linhas.length - top.length

  const barras = top.map((l, i) => ({
    label: l.funil,
    valor: l.ftds,
    cor: CORES[i % CORES.length],
    destaque: `${formatarNumero(l.ftds)} FTD`,
  }))

  const opcoesCasa = [{ id: 'todas', nome: 'Todas as casas' }, ...dados.casas.map((c) => ({ id: c, nome: c }))]
  const opcoesSite = [
    { id: 'total', nome: 'Período todo' },
    ...dados.siteIds.map((s) => {
      const p = dados.periodoPorSite[s]
      return { id: s, nome: `Site ${s}`, sub: p ? `${p.inicio}–${p.fim}` : undefined }
    }),
  ]

  const corCasa = modoCasa !== 'todas' ? CORES_CASA[modoCasa] ?? 'var(--text-primary)' : 'var(--text-primary)'

  return (
    <SlideShell
      compact
      eyebrow="Tráfego · Funis de WhatsApp"
      titulo="Ranking de funis — Registros e FTDs"
    >
      {temCasas && <SlideItem><Pills opcoes={opcoesCasa} valor={modoCasa} onChange={setModoCasa} /></SlideItem>}
      <SlideItem><Pills opcoes={opcoesSite} valor={modoSite} onChange={setModoSite} /></SlideItem>

      {(() => {
        const kpis = [
          { chave: 'funisWa.kpi.registros', v: formatarNumero(totalReg), l: 'Registros', c: 'var(--text-primary)' },
          { chave: 'funisWa.kpi.ftds', v: formatarNumero(totalFtd), l: 'FTDs', c: 'var(--success)' },
          { chave: 'funisWa.kpi.cpas', v: formatarNumero(totalCpa), l: 'CPAs', c: corCasa },
          { chave: 'funisWa.kpi.conv', v: formatarPercentual(convGeral), l: 'Conv. reg→ftd', c: 'var(--text-primary)' },
        ].filter((k) => !oculto(k.chave))
        if (!kpis.length) return null
        return (
          <SlideItem className={`grid ${gridColsAuto(kpis.length, 4)} gap-3 w-full`}>
            {kpis.map((k) => (
              <div key={k.l} className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] py-2 text-center">
                <div className="text-xl md:text-2xl font-bold" style={{ color: k.c }}>{k.v}</div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{k.l}</div>
              </div>
            ))}
          </SlideItem>
        )
      })()}

      <SlideItem
        className={`grid w-full gap-4 ${!oculto('funisWa.barras') && !oculto('funisWa.tabela') ? 'md:grid-cols-2' : 'grid-cols-1'}`}
      >
        {!oculto('funisWa.barras') && (
          <BarraComparativa itens={barras} alturaBarra={18} formatarValor={(v) => formatarNumero(v)} />
        )}

        {!oculto('funisWa.tabela') && (
        <div className="overflow-hidden rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)]">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-[var(--glass-border)]">
              <tr>
                <th className="px-2 py-1.5 text-[var(--text-primary)]">Funil</th>
                <th className="px-2 py-1.5 text-[var(--text-primary)] text-right">Reg</th>
                <th className="px-2 py-1.5 text-[var(--text-primary)] text-right">FTD</th>
                <th className="px-2 py-1.5 text-[var(--text-primary)] text-right">CPA</th>
                <th className="px-2 py-1.5 text-[var(--text-primary)] text-right">Conv</th>
              </tr>
            </thead>
            <tbody>
              {top.map((l) => (
                <tr key={l.funil} className="border-t border-[var(--glass-border)]">
                  <td className="px-2 py-1 font-medium text-[var(--text-primary)]">{l.funil}</td>
                  <td className="px-2 py-1 text-right">{formatarNumero(l.registros)}</td>
                  <td className="px-2 py-1 text-right font-bold text-[var(--success)]">{formatarNumero(l.ftds)}</td>
                  <td className="px-2 py-1 text-right">{formatarNumero(l.cpas)}</td>
                  <td className="px-2 py-1 text-right text-[var(--text-secondary)]">
                    {l.conv === null ? '—' : formatarPercentual(l.conv)}
                  </td>
                </tr>
              ))}
              {resto > 0 && (
                <tr className="border-t border-[var(--glass-border)] text-[var(--text-muted)]">
                  <td className="px-2 py-1" colSpan={5}>+{resto} funis</td>
                </tr>
              )}
              <tr className="border-t border-[var(--glass-border)] bg-[var(--glass-border)] font-semibold">
                <td className="px-2 py-1.5">TOTAL</td>
                <td className="px-2 py-1.5 text-right">{formatarNumero(totalReg)}</td>
                <td className="px-2 py-1.5 text-right">{formatarNumero(totalFtd)}</td>
                <td className="px-2 py-1.5 text-right">{formatarNumero(totalCpa)}</td>
                <td className="px-2 py-1.5 text-right">{formatarPercentual(convGeral)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        )}
      </SlideItem>
    </SlideShell>
  )
}
