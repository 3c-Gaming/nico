'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, ExternalLink, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import { Spinner } from '../ui/Spinner'
import { Input } from '../ui/Input'
import type { DisparoDaxx } from '@/types'

interface StepDaxxCampanhaProps {
  campanha?: DisparoDaxx
  onChange: (campanha: DisparoDaxx | undefined) => void
}

function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function StepDaxxCampanha({ campanha, onChange }: StepDaxxCampanhaProps) {
  const [campanhas, setCampanhas] = useState<DisparoDaxx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function fetch() {
    setLoading(true)
    setError(null)
    try {
      const res = await window.fetch('/api/daxx/campanhas')
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao carregar campanhas')
      const data = await res.json()
      setCampanhas(data.campanhas ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [])

  const filtradas = useMemo(() => {
    if (!search.trim()) return campanhas
    const q = search.toLowerCase()
    return campanhas.filter((c) =>
      c.nome.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q) ||
      c.responsavel.toLowerCase().includes(q)
    )
  }, [campanhas, search])

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Spinner size={32} /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-md text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--d1)]"
          />
        </div>
        <button
          onClick={fetch}
          className="flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-secondary)]"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {!error && campanhas.length === 0 && (
        <div className="text-center py-12 text-sm text-[var(--text-muted)]">
          Nenhuma campanha encontrada na DAXX.
        </div>
      )}

      {!error && filtradas.length === 0 && campanhas.length > 0 && (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          Nenhuma campanha corresponde à busca.
        </div>
      )}

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filtradas.map((c) => {
          const selected = campanha?.id === c.id
          return (
            <button
              key={c.id}
              onClick={() => onChange(selected ? undefined : c)}
              className={`w-full text-left p-3 rounded-md border transition-colors ${
                selected
                  ? 'border-[var(--d1)] bg-[var(--d1)]/5'
                  : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border mt-0.5 transition-colors ${
                  selected
                    ? 'bg-[var(--d1)] border-[var(--d1)] text-white'
                    : 'border-[var(--border)]'
                }`}>
                  {selected && <Check size={10} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">{c.nome}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      c.status === 'Concluído' ? 'bg-green-500/15 text-green-500' :
                      c.status === 'Executando' ? 'bg-blue-500/15 text-blue-500' :
                      'bg-yellow-500/15 text-yellow-500'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-muted)]">
                    <span>Base: <strong className="text-[var(--text-primary)]">{formatNumero(c.totalBase)}</strong></span>
                    <span>Entregues: <strong className="text-green-500">{formatNumero(c.entregues)}</strong></span>
                    <span>Lidas: <strong className="text-[var(--d1)]">{formatNumero(c.lidas)}</strong></span>
                    <span>Rejeitados: <strong className="text-red-400">{formatNumero(c.rejeitados)}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[var(--text-muted)]">{c.dataCriacao}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">• {c.responsavel}</span>
                    {c.linkTemplate && (
                      <a
                        href={c.linkTemplate}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-0.5 text-[10px] text-[var(--d1)] hover:underline"
                      >
                        Ver mensagem <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {campanhas.length > 0 && (
        <div className="text-[10px] text-[var(--text-muted)] text-right">{campanhas.length} campanha(s)</div>
      )}
    </div>
  )
}
