'use client'

import { useState, useMemo, useEffect } from 'react'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { getState } from '@/lib/store'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { StatusDot } from '../ui/StatusDot'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { Search, GitBranch, ExternalLink, Trash2, RefreshCw, Building2, Layers, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { sincronizarDisparos } from '@/lib/tracking/sync'
import type { TipoDisparo, TrackingResultado } from '@/types'

type SortField = 'dataDisparo' | 'status'
type SortDir = 'asc' | 'desc'

const TIPOS: TipoDisparo[] = ['D1', 'D3', 'D5', 'D7', 'PONTUAL']

export function ListaDisparos() {
  const { list, getById, remove, update } = useDisparos()
  const { casas, list: casasList } = useCasasAposta()
  const { addToast } = useToast()
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoDisparo | ''>('')
  const [filtroCasa, setFiltroCasa] = useState('')
  const [filtroFunil, setFiltroFunil] = useState('')
  const [sortField, setSortField] = useState<SortField>('dataDisparo')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recalculando, setRecalculando] = useState(false)

  // Backfill automático ao carregar a página
  useEffect(() => {
    const pendentes = list.filter((d) => d.base.driveFileId && d.base.totalRegistros == null)
    if (!pendentes.length) return
    setRecalculando(true)
    fetch('/api/disparos/backfill-custos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disparos: pendentes.map((d) => ({ id: d.id, driveFileId: d.base.driveFileId! })),
      }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.resultados) {
          for (const r of json.resultados) {
            const dis = getById(r.id)
            if (dis) {
              update(r.id, { base: { ...dis.base, totalRegistros: r.totalLinhas } })
            }
          }
          if (json.resultados.length > 0) {
            addToast('success', `Custo calculado para ${json.resultados.length} disparo(s)`)
          }
        }
      })
      .catch(() => {})
      .finally(() => setRecalculando(false))
  }, [])

  // Auto-sync tracking ao carregar
  const [sincronizando, setSincronizando] = useState(false)

  useEffect(() => {
    const hoje = new Date().toISOString().split('T')[0]
    const comTracking = list.filter((d) => (d.utm || d.betmgmPid) && d.dataDisparo === hoje)
    if (!comTracking.length) return

    setSincronizando(true)
    sincronizarDisparos(comTracking, hoje)
      .then((resultados) => {
        for (const [id, r] of Object.entries(resultados)) {
          const dis = getById(id)
          if (dis) {
            update(id, {
              resultados: {
                ...(dis.resultados ?? { registros: 0, ftds: 0, cpas: 0, custo: 0, valorFaturadoCPA: 0 }),
                registros: r.registros,
                ftds: r.ftds,
                atualizadoEm: new Date().toISOString(),
              },
            })
          }
        }
      })
      .catch(() => {})
      .finally(() => setSincronizando(false))
  }, [])

  async function handleRecalcularCustos() {
    const pendentes = list.filter((d) => d.base.driveFileId && d.base.totalRegistros == null)
    if (!pendentes.length) {
      addToast('info', 'Todos os disparos já têm custo calculado')
      return
    }
    setRecalculando(true)
    try {
      const res = await fetch('/api/disparos/backfill-custos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disparos: pendentes.map((d) => ({ id: d.id, driveFileId: d.base.driveFileId! })),
        }),
      })
      const json = await res.json()
      if (json?.resultados) {
        for (const r of json.resultados) {
          const dis = getById(r.id)
          if (dis) {
            update(r.id, { base: { ...dis.base, totalRegistros: r.totalLinhas } })
          }
        }
        addToast('success', `Custo calculado para ${json.resultados.length} disparo(s)`)
      }
    } catch {
      addToast('error', 'Erro ao recalcular custos')
    } finally {
      setRecalculando(false)
    }
  }

  const filtered = useMemo(() => {
    let items = [...list]

    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter((d) => d.nomenclatura.toLowerCase().includes(q))
    }

    if (filtroTipo) {
      items = items.filter((d) => d.tipo === filtroTipo)
    }

    if (filtroCasa) {
      items = items.filter((d) => d.casasAposta.includes(filtroCasa))
    }

    if (filtroFunil) {
      const configs = getState().flowTagConfigs
      items = items.filter((d) =>
        (d.flowIds ?? []).some((flowId) => configs[flowId]?.funil === filtroFunil)
      )
    }

    items.sort((a, b) => {
      if (sortField === 'dataDisparo') {
        return sortDir === 'asc'
          ? a.dataDisparo.localeCompare(b.dataDisparo)
          : b.dataDisparo.localeCompare(a.dataDisparo)
      }
      return sortDir === 'asc'
        ? a.status.localeCompare(b.status)
        : b.status.localeCompare(a.status)
    })

    return items
  }, [list, busca, filtroTipo, filtroCasa, filtroFunil, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function handleDelete(id: string) {
    if (confirm('Tem certeza que deseja apagar este disparo?')) {
      remove(id)
      addToast('success', 'Disparo removido')
    }
  }

  const selected = selectedId ? getById(selectedId) : null

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por nomenclatura..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <div className="flex gap-1">
          {TIPOS.map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(filtroTipo === t ? '' : t)}
              className={`px-2.5 h-7 text-xs font-medium rounded transition-colors ${
                filtroTipo === t
                  ? 'bg-[var(--d1)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex items-center">
            <Building2 size={12} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
            <select
              value={filtroCasa}
              onChange={(e) => { setFiltroCasa(e.target.value); setFiltroFunil('') }}
              className="h-7 pl-7 pr-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)] appearance-none cursor-pointer"
            >
              <option value="">Todas casas</option>
              {casasList.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          {filtroCasa && (
            <div className="relative flex items-center">
              <Layers size={12} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
              <select
                value={filtroFunil}
                onChange={(e) => setFiltroFunil(e.target.value)}
                className="h-7 pl-7 pr-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)] appearance-none cursor-pointer"
              >
                <option value="">Todos funis</option>
                {casas[filtroCasa]?.funilIds.map((fid) => (
                  <option key={fid} value={fid}>{fid}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button
          onClick={handleRecalcularCustos}
          disabled={recalculando}
          className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          <RefreshCw size={12} className={recalculando ? 'animate-spin' : ''} />
          {recalculando ? 'Calculando...' : 'Recalcular Custos'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5 w-10">#</th>
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Nomenclatura</th>
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Tipo</th>
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Casa</th>
              <th
                className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)]"
                onClick={() => toggleSort('dataDisparo')}
              >
                Data {sortField === 'dataDisparo' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Horário</th>
              <th
                className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)]"
                onClick={() => toggleSort('status')}
              >
                Status {sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Conversão</th>
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Registros</th>
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">FTDs</th>
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Base</th>
              <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Custo</th>
              <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2.5 w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className="border-b border-[var(--border)] hover:bg-[var(--bg-surface)] cursor-pointer transition-colors"
              >
                <td className="px-3 py-3 text-[var(--text-muted)] text-xs">
                  {d.esteiraPaiId ? <GitBranch size={14} className="text-[var(--d3)]" /> : '-'}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-[var(--text-primary)] max-w-[250px] truncate">
                  {d.nomenclatura}
                </td>
                <td className="px-3 py-3">
                  <Badge variant="tipo" value={d.tipo} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {d.casasAposta.map((cId) => {
                      const c = casas[cId]
                      if (!c) return null
                      return <Chip key={cId} label={c.nome} cor={c.cor} size="sm" />
                    })}
                  </div>
                </td>
                <td className="px-3 py-3 text-[var(--text-primary)] text-xs">{d.dataDisparo}</td>
                <td className="px-3 py-3 text-[var(--text-secondary)] text-xs">{d.horarioDisparo}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={d.status} size={6} />
                    <Badge variant="status" value={d.status} />
                  </div>
                </td>
                <td className="px-3 py-3">
                  {(() => {
                    const c = d.conversao
                    if (!c || c.entreguesDaxx <= 0) return <span className="text-xs text-[var(--text-muted)]">—</span>
                    const pct = ((c.leadsFluxo / c.entreguesDaxx) * 100).toFixed(2)
                    return (
                      <span className="text-xs font-mono font-medium text-[var(--d1)]">
                        {pct}%
                      </span>
                    )
                  })()}
                </td>
                <td className="px-3 py-3">
                  {d.resultados?.registros != null
                    ? <span className="text-xs font-mono text-[var(--text-primary)]">{d.resultados.registros}</span>
                    : <span className="text-xs text-[var(--text-muted)]">—</span>
                  }
                </td>
                <td className="px-3 py-3">
                  {d.resultados?.ftds != null
                    ? <span className="text-xs font-mono text-[var(--d1)]">{d.resultados.ftds}</span>
                    : <span className="text-xs text-[var(--text-muted)]">—</span>
                  }
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs ${
                    d.base.status === 'disponivel' ? 'text-[var(--success)]' :
                    d.base.status === 'erro' ? 'text-[var(--error)]' :
                    'text-[var(--text-muted)]'
                  }`}>
                    {d.base.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  {d.base.totalRegistros != null
                    ? <span className="text-xs font-mono text-[var(--text-primary)]">{(d.base.totalRegistros * 0.13).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    : <span className="text-xs text-[var(--text-muted)]">—</span>
                  }
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/disparos/${d.id}`}
                      className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                      title="Ver detalhes"
                    >
                      <ExternalLink size={14} />
                    </Link>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-elevated)] transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">
            Nenhum disparo encontrado
          </div>
        )}
      </div>

      <Modal
        open={!!selectedId && !!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.nomenclatura ?? ''}
        width="520px"
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Tipo</span>
                <Badge variant="tipo" value={selected.tipo} />
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Status</span>
                <Badge variant="status" value={selected.status} />
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Data</span>
                <span className="text-[var(--text-primary)]">{selected.dataDisparo}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Horário</span>
                <span className="text-[var(--text-primary)]">{selected.horarioDisparo}</span>
              </div>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Casas de Aposta</span>
              <div className="flex flex-wrap gap-1">
                {selected.casasAposta.map((cId) => {
                  const c = casas[cId]
                  if (!c) return null
                  return <Chip key={cId} label={c.nome} cor={c.cor} />
                })}
              </div>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Base CSV</span>
              <span className="text-[var(--text-primary)]">{selected.base.status}</span>
              {selected.base.nomeArquivo && (
                <span className="text-[var(--text-secondary)] ml-2">({selected.base.nomeArquivo})</span>
              )}
            </div>
            {selected.templateDaxx && (
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">Template DAXX</span>
                <span className="text-[var(--text-primary)]">{selected.templateDaxx.nome}</span>
              </div>
            )}
            {selected.numerosSendpulse && selected.numerosSendpulse.length > 0 && (
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">Números Sendpulse</span>
                <div className="flex flex-wrap gap-1">
                  {selected.numerosSendpulse.map((n) => (
                    <span key={n.id} className="text-[var(--text-primary)] font-mono text-xs">{n.numero}</span>
                  ))}
                </div>
              </div>
            )}
            {selected.notas && (
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">Notas</span>
                <p className="text-[var(--text-primary)]">{selected.notas}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Link href={`/disparos/${selected.id}`}>
                <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                  Detalhes
                </Button>
              </Link>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => {
                  handleDelete(selected.id)
                  setSelectedId(null)
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
