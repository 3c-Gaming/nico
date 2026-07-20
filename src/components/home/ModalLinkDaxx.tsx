'use client'

import { useState, useMemo } from 'react'
import { Search, Link2, Unlink, ChevronDown, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { parsearNomeCampanhaDaxx } from '@/lib/daxx-parser'
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
  const [busca, setBusca] = useState('')
  const [selecionandoCampanha, setSelecionandoCampanha] = useState<string | null>(null)

  const vinculadas = useMemo(() => {
    const map = new Map<string, Disparo>()
    for (const d of disparos) {
      if (d.templateDaxx?.id) map.set(d.templateDaxx.id, d)
    }
    return map
  }, [disparos])

  const campanhasDeHoje = useMemo(() => {
    const hoje = new Date()
    const hojeKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    return campanhas.filter((c) => {
      const parsed = parsearNomeCampanhaDaxx(c.nome)
      return parsed.dataDisparo === hojeKey
    })
  }, [campanhas])

  const campanhasFiltradas = useMemo(() => {
    const lista = campanhasDeHoje.length > 0 ? campanhasDeHoje : campanhas
    if (!busca.trim()) return lista
    const q = busca.toLowerCase()
    return lista.filter((c) =>
      c.nome.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    )
  }, [campanhasDeHoje, campanhas, busca])

  const disparosSemLink = useMemo(() => {
    const linkados = new Set(disparos.filter((d) => d.templateDaxx?.id).map((d) => d.id))
    return disparos.filter((d) => !linkados.has(d.id))
  }, [disparos])

  function handleLink(campanha: DisparoDaxx, disparoId: string) {
    onLink(disparoId, {
      id: campanha.id,
      nome: campanha.nome,
      url: campanha.linkTemplate,
      descricao: `Base: ${campanha.totalBase} | Entregues: ${campanha.entregues} | Lidas: ${campanha.lidas}`,
    })
    setSelecionandoCampanha(null)
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
    <Modal open={open} onClose={onClose} title="Linkar DAXX" width="640px">
      {selecionandoCampanha ? (
        <div className="space-y-3">
          <button
            onClick={() => { setSelecionandoCampanha(null); setBusca('') }}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ← Voltar
          </button>

          <p className="text-xs text-[var(--text-muted)]">
            Selecione um disparo de hoje para linkar à campanha{' '}
            <strong className="text-[var(--text-primary)]">
              {campanhas.find((c) => c.id === selecionandoCampanha)?.nome}
            </strong>
          </p>

          {disparosSemLink.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-6">
              Todos os disparos de hoje já estão linkados a campanhas DAXX.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {disparosSemLink.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    const campanha = campanhas.find((c) => c.id === selecionandoCampanha)
                    if (campanha) handleLink(campanha, d.id)
                  }}
                  className="w-full text-left p-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{d.nomenclatura}</span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">{d.tipo}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted)]">
                        <span>{d.horarioDisparo}</span>
                        <span>·</span>
                        <span>{d.casasAposta.join(', ')}</span>
                      </div>
                    </div>
                    <Link2 size={14} className="text-[var(--text-muted)] shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar campanha DAXX..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-md text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--d1)]"
            />
          </div>

          {campanhasDeHoje.length === 0 && campanhas.length > 0 && (
            <p className="text-[10px] text-[var(--text-muted)]">
              Nenhuma campanha de hoje encontrada. Mostrando todas ({campanhas.length}).
            </p>
          )}

          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {campanhasFiltradas.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-6">
                {campanhas.length === 0 ? 'Nenhuma campanha DAXX disponível' : 'Nenhuma campanha corresponde à busca'}
              </p>
            )}
            {campanhasFiltradas.map((c) => {
              const vinculado = vinculadas.get(c.id)
              return (
                <div
                  key={c.id}
                  className="p-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]"
                >
                  <div className="flex items-start justify-between gap-2">
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
                        <span>Rejeitados: <strong className="text-red-400">{formatNumero(c.rejeitados)}</strong></span>
                      </div>
                      {vinculado && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-[var(--text-muted)]">Linkado:</span>
                          <span className="text-[10px] font-medium text-[var(--d1)]">
                            {vinculado.nomenclatura}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">· {vinculado.tipo}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {vinculado ? (
                        <>
                          <button
                            onClick={() => handleUnlink(vinculado.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Deslinkar"
                          >
                            <Unlink size={12} />
                          </button>
                          <button
                            onClick={() => setSelecionandoCampanha(c.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[var(--d1)] hover:bg-[var(--d1)]/10 transition-colors"
                            title="Trocar disparo"
                          >
                            <Link2 size={12} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setSelecionandoCampanha(c.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: 'var(--d1)' }}
                        >
                          <Link2 size={12} />
                          Linkar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {campanhasFiltradas.length > 0 && (
            <div className="text-[10px] text-[var(--text-muted)] text-right">
              {campanhasFiltradas.length} campanha(s) · {disparosSemLink.length} disparo(s) disponível(is)
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
