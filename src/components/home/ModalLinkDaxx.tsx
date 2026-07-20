'use client'

import { useState, useMemo } from 'react'
import { Search, Link2, Unlink, Check, ExternalLink, ChevronLeft } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { Disparo, DisparoDaxx, TemplateDaxx } from '@/types'

interface ModalLinkDaxxProps {
  open: boolean
  funilNome: string | null
  disparos: Disparo[]
  campanhas: DisparoDaxx[]
  onLink: (disparoId: string, templateDaxx: TemplateDaxx | undefined) => void
  onClose: () => void
}

export function ModalLinkDaxx({ open, funilNome, disparos, campanhas, onLink, onClose }: ModalLinkDaxxProps) {
  const [selecionandoPara, setSelecionandoPara] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const campanhasFiltradas = useMemo(() => {
    if (!busca.trim()) return campanhas
    const q = busca.toLowerCase()
    return campanhas.filter((c) =>
      c.nome.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    )
  }, [campanhas, busca])

  function handleLink(disparoId: string, campanha: DisparoDaxx) {
    onLink(disparoId, {
      id: campanha.id,
      nome: campanha.nome,
      url: campanha.linkTemplate,
      descricao: `Base: ${campanha.totalBase} | Entregues: ${campanha.entregues} | Lidas: ${campanha.lidas}`,
    })
    setSelecionandoPara(null)
    setBusca('')
  }

  function handleUnlink(disparoId: string) {
    onLink(disparoId, undefined)
  }

  function formatNumero(n: number) {
    return n.toLocaleString('pt-BR')
  }

  if (!funilNome) return null

  return (
    <Modal open={open} onClose={onClose} title={`Linkar DAXX — ${funilNome}`} width="600px">
      {selecionandoPara ? (
        <div className="space-y-3">
          <button
            onClick={() => { setSelecionandoPara(null); setBusca('') }}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeft size={14} />
            Voltar
          </button>

          <p className="text-xs text-[var(--text-muted)]">
            Selecione uma campanha DAXX para linkar ao disparo{' '}
            <strong className="text-[var(--text-primary)]">
              {disparos.find((d) => d.id === selecionandoPara)?.nomenclatura}
            </strong>
          </p>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar campanha..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
              className="w-full h-9 pl-9 pr-3 rounded-md text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--d1)]"
            />
          </div>

          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {campanhasFiltradas.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-6">
                {campanhas.length === 0 ? 'Nenhuma campanha DAXX disponível' : 'Nenhuma campanha corresponde à busca'}
              </p>
            )}
            {campanhasFiltradas.map((c) => (
              <button
                key={c.id}
                onClick={() => handleLink(selecionandoPara, c)}
                className="w-full text-left p-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">{c.nome}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        c.status === 'Concluído' ? 'bg-green-500/15 text-green-500' :
                        c.status === 'Executando' ? 'bg-blue-500/15 text-blue-500' :
                        'bg-yellow-500/15 text-yellow-500'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--text-muted)]">
                      <span>Base: <strong className="text-[var(--text-primary)]">{formatNumero(c.totalBase)}</strong></span>
                      <span>Entregues: <strong className="text-green-500">{formatNumero(c.entregues)}</strong></span>
                      <span>Lidas: <strong className="text-[var(--d1)]">{formatNumero(c.lidas)}</strong></span>
                    </div>
                  </div>
                  <Link2 size={14} className="text-[var(--text-muted)] shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {disparos.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center py-6">
              Nenhum disparo neste funil.
            </p>
          )}
          {disparos.map((d) => {
            const linkado = !!d.templateDaxx?.id
            return (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {d.nomenclatura}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {d.tipo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[var(--text-muted)]">{d.dataDisparo}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">·</span>
                    <span className="text-[11px] text-[var(--text-muted)]">{d.horarioDisparo}</span>
                    {linkado && (
                      <>
                        <span className="text-[11px] text-[var(--text-muted)]">·</span>
                        <span className="text-[11px] text-[var(--d1)] truncate max-w-[200px]">
                          DAXX: {d.templateDaxx!.nome}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {linkado ? (
                    <>
                      <button
                        onClick={() => handleUnlink(d.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Deslinkar DAXX"
                      >
                        <Unlink size={12} />
                        Deslinkar
                      </button>
                      <button
                        onClick={() => setSelecionandoPara(d.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[var(--d1)] hover:bg-[var(--d1)]/10 transition-colors"
                        title="Trocar campanha DAXX"
                      >
                        <Link2 size={12} />
                        Trocar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelecionandoPara(d.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: 'var(--d1)' }}
                    >
                      <Link2 size={12} />
                      Linkar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
