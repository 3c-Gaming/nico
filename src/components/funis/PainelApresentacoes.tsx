'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ExternalLink, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import type { FunilComparacao } from '@/types'

function formatarTempoRelativo(iso: string): string {
  const agora = Date.now()
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return iso
  const diffMs = agora - ts
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`
  if (diffH < 24) return `há ${diffH}h`
  if (diffD < 7) return `há ${diffD}d`
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface PainelApresentacoesProps {
  aberto: boolean
  onClose: () => void
}

export function PainelApresentacoes({ aberto, onClose }: PainelApresentacoesProps) {
  const [comparacoes, setComparacoes] = useState<FunilComparacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!aberto) return
    fetch('/api/funis-comparacoes')
      .then((r) => r.json())
      .then((data) => setComparacoes(data.comparacoes ?? []))
      .catch(() => setComparacoes([]))
      .finally(() => setCarregando(false))
  }, [aberto])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (aberto) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [aberto, onClose])

  function abrir(comparacao: FunilComparacao) {
    const params = new URLSearchParams({
      flows: comparacao.flowIds.join(','),
      inicio: comparacao.inicio,
      fim: comparacao.fim,
    })
    window.open(`/funis/apresentar?${params.toString()}`, '_blank')
  }

  async function excluir(id: string) {
    setComparacoes((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/funis-comparacoes?id=${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <AnimatePresence>
      {aberto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 w-[360px] max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Apresentações</h2>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {carregando ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size={20} />
                </div>
              ) : comparacoes.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-10">Nenhuma apresentação salva ainda.</p>
              ) : (
                comparacoes.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => abrir(c)}
                        className="flex-1 min-w-0 text-left flex items-start gap-1.5"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate flex items-center gap-1.5">
                            {c.titulo}
                            <ExternalLink size={11} className="text-[var(--text-muted)] shrink-0" />
                          </div>
                          <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                            {c.funis.join(', ') || `${c.flowIds.length} funil(is)`}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-1">
                            {c.inicio === c.fim ? c.inicio : `${c.inicio} até ${c.fim}`} · {formatarTempoRelativo(c.criadoEm)}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => excluir(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--error)] transition-opacity shrink-0"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
