'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { RefreshCw, ChevronRight, ChevronDown, AlertTriangle, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import Link from 'next/link'
import type { DisparoAgendadoDaxx } from '@/types'

const TOKEN_KEY = 'nico_daxx_token'
const KNOWN_FIELDS = new Set(['id', 'cliente_id', 'status', 'agendado_para', 'criado_em', 'atualizado_em', 'marcas'])

function StatusBadge({ status }: { status: string }) {
  const cor = status === 'executando' ? 'var(--d3)' : status === 'agendado' ? 'var(--d1)' : 'var(--text-muted)'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ backgroundColor: `${cor}18`, color: cor }}
    >
      {status}
    </span>
  )
}

function CamposExpandidos({ data, ignorar }: { data: Record<string, unknown>; ignorar: Set<string> }) {
  const entradas = Object.entries(data).filter(([k]) => !ignorar.has(k))
  if (entradas.length === 0) {
    return <span className="text-xs text-[var(--text-muted)] italic">Nenhum campo adicional</span>
  }
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      {entradas.map(([key, val]) => (
        <Fragment key={key}>
          <span className="text-[var(--text-muted)] font-mono text-right">{key}</span>
          <span className="text-[var(--text-primary)] font-mono break-all">{formatarValor(val)}</span>
        </Fragment>
      ))}
    </div>
  )
}

function formatarValor(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function formatarData(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function DaxxPage() {
  const [disparos, setDisparos] = useState<DisparoAgendadoDaxx[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [tokenOk, setTokenOk] = useState<boolean | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    setToken(saved)
  }, [])

  const fetchData = useCallback(async (isRefresh = false) => {
    const tk = localStorage.getItem(TOKEN_KEY) || ''
    if (!tk) {
      setError('Token daxX não configurado')
      setLoading(false)
      setRefreshing(false)
      setTokenOk(false)
      return
    }

    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/daxx/disparos-agendados', {
        headers: { 'x-daxx-token': tk },
      })

      if (res.status === 401) {
        const data = await res.json()
        setError(data.error || 'Token inválido ou expirado')
        setTokenOk(false)
        return
      }

      if (!res.ok) {
        throw new Error(`Erro ${res.status}`)
      }

      const data = await res.json()
      setDisparos(data.disparos ?? [])
      setTokenOk(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <>
      <PageHeader
        titulo="Disparos daxX"
        descricao="Agendamentos na plataforma DisparosSimples"
        acoes={
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {!token && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            Token daxX não configurado.
            <Link href="/configuracoes" className="underline hover:no-underline ml-1">Configurar em Configurações</Link>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
            {tokenOk === false && token && (
              <Link href="/configuracoes" className="underline hover:no-underline ml-1">Atualizar token</Link>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        )}

        {!loading && token && disparos.length === 0 && !error && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum agendamento encontrado.
          </div>
        )}

        {!loading && disparos.length > 0 && (
          <>
            <div className="flex items-center justify-end gap-2 text-xs text-[var(--text-muted)]">
              {tokenOk && <span className="text-green-500">✓ Token válido</span>}
              <span>{disparos.length} agendamento(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)] w-6"></th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Agendado para</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Marca</th>
                  </tr>
                </thead>
                <tbody>
                  {disparos.map((item) => {
                    const isExpanded = expandedId === item.id
                    const ignorar = new Set(KNOWN_FIELDS)

                    return (
                      <Fragment key={item.id}>
                        <tr
                          className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          <td className="py-3 px-3">
                            {isExpanded ? <ChevronDown size={14} className="text-[var(--text-muted)]" /> : <ChevronRight size={14} className="text-[var(--text-muted)]" />}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-[var(--text-primary)]">{formatarData(item.agendado_para)}</span>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[var(--text-primary)]">{item.marcas?.nome ?? '—'}</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={4} className="p-0">
                              <div className="py-4 px-6 bg-[var(--bg-elevated)]/30 border-b border-[var(--border)]">
                                <CamposExpandidos data={item as unknown as Record<string, unknown>} ignorar={ignorar} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
