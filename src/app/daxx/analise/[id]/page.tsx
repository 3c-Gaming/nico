'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, XCircle, Ban } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { BarraComparativa } from '@/components/resultados-junho/BarraComparativa'
import type { AnaliseBaseDaxx } from '@/types'

function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatSegundos(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}min`
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`
  return `${(s / 86400).toFixed(1)}d`
}

function StatBox({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
      <div className="text-xl font-bold font-mono" style={{ color: cor }}>{valor}</div>
      <div className="text-[10px] text-[var(--text-muted)] mt-1">{label}</div>
    </div>
  )
}

function ListaNumeros({ titulo, icone, itens, colunas }: {
  titulo: string
  icone: React.ReactNode
  itens: { numero: string; extra?: string | null }[]
  colunas: number
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        {icone}
        {titulo} ({itens.length})
      </h2>
      {itens.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">Nenhum registro.</p>
      ) : (
        <div className="max-h-[320px] overflow-y-auto rounded-md border border-[var(--border)]">
          <table className="w-full text-xs">
            <tbody>
              {itens.map((item) => (
                <tr key={item.numero} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-1.5 px-3 font-mono text-[var(--text-primary)]">{item.numero}</td>
                  {colunas > 1 && (
                    <td className="py-1.5 px-3 text-[var(--text-muted)]">{item.extra ?? '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AnaliseBaseInner() {
  const params = useParams()
  const id = params.id as string
  const searchParams = useSearchParams()
  const nome = searchParams.get('nome') ?? ''

  const [analise, setAnalise] = useState<AnaliseBaseDaxx | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/daxx/campanhas/${encodeURIComponent(id)}/base`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao buscar base')
        if (!cancelado) setAnalise(data.analise)
      } catch (err) {
        if (!cancelado) setError((err as Error).message)
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [id])

  return (
    <>
      <PageHeader
        titulo="Análise de Base"
        descricao={nome || 'Relatório de entrega por destinatário'}
        acoes={
          <Link
            href="/daxx"
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar
          </Link>
        }
      />

      <div className="p-6 space-y-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size={24} />
            <p className="text-sm text-[var(--text-muted)]">Baixando base na DAXX, pode levar alguns segundos...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {analise && (
          <>
            <section>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatBox label="Total" valor={formatNumero(analise.total)} cor="var(--text-primary)" />
                <StatBox label="Taxa de Entrega" valor={`${analise.taxaEntregaTotal}%`} cor="var(--info)" />
                <StatBox label="Taxa de Leitura" valor={`${analise.pctLidos}%`} cor="var(--success)" />
                <StatBox label="Taxa de Falha" valor={`${analise.pctFalhas}%`} cor="var(--error)" />
                <StatBox label="Pendentes" valor={`${analise.pctPendentes}%`} cor="var(--warning)" />
                <StatBox label="Opt-out" valor={`${analise.pctOptOuts}%`} cor="var(--pontual)" />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Funil de entrega</h2>
              <BarraComparativa
                itens={[
                  { label: 'Enviado', valor: analise.total, cor: 'var(--info)' },
                  { label: 'Entregue', valor: analise.entregues + analise.lidos, cor: 'var(--success)' },
                  { label: 'Lido', valor: analise.lidos, cor: 'var(--d1)' },
                ]}
                formatarValor={formatNumero}
              />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                Velocidade de leitura
                <span className="text-xs font-normal text-[var(--text-muted)] ml-2">
                  média {formatSegundos(analise.tempoLeituraMedioSeg)} · mediana {formatSegundos(analise.tempoLeituraMedianaSeg)}
                </span>
              </h2>
              <BarraComparativa
                itens={analise.faixasLeitura.map((f) => ({ label: f.label, valor: f.total, cor: 'var(--d1)' }))}
                formatarValor={formatNumero}
              />
            </section>

            {analise.distribuicaoDdd.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Distribuição geográfica (DDD)</h2>
                <BarraComparativa
                  itens={analise.distribuicaoDdd.map((d) => ({ label: `${d.ddd} (${d.uf})`, valor: d.total, cor: 'var(--d3)' }))}
                  formatarValor={formatNumero}
                />
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ListaNumeros
                titulo="Falhas"
                icone={<XCircle size={16} className="text-[var(--error)]" />}
                colunas={2}
                itens={analise.falhasLista.map((f) => ({ numero: f.numero, extra: f.erroDescricao }))}
              />
              <ListaNumeros
                titulo="Opt-outs"
                icone={<Ban size={16} className="text-[var(--pontual)]" />}
                colunas={1}
                itens={analise.optOutsLista.map((n) => ({ numero: n }))}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default function AnaliseBasePage() {
  return (
    <Suspense>
      <AnaliseBaseInner />
    </Suspense>
  )
}
