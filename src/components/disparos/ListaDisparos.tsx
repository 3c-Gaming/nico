'use client'

import { useState, useMemo } from 'react'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { StatusDot } from '../ui/StatusDot'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Search, GitBranch } from 'lucide-react'
import type { Disparo, TipoDisparo } from '@/types'

type SortField = 'dataDisparo' | 'status'
type SortDir = 'asc' | 'desc'

const TIPOS: TipoDisparo[] = ['D1', 'D3', 'D5', 'D7', 'PONTUAL']

export function ListaDisparos() {
  const { list, getById } = useDisparos()
  const { casas } = useCasasAposta()
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoDisparo | ''>('')
  const [sortField, setSortField] = useState<SortField>('dataDisparo')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let items = [...list]

    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter((d) => d.nomenclatura.toLowerCase().includes(q))
    }

    if (filtroTipo) {
      items = items.filter((d) => d.tipo === filtroTipo)
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
  }, [list, busca, filtroTipo, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
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
              <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2.5">Base</th>
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
                  <span className={`text-xs ${
                    d.base.status === 'disponivel' ? 'text-[var(--success)]' :
                    d.base.status === 'erro' ? 'text-[var(--error)]' :
                    'text-[var(--text-muted)]'
                  }`}>
                    {d.base.status}
                  </span>
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
            {selected.numeroSendpulse && (
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">Número Sendpulse</span>
                <span className="text-[var(--text-primary)]">{selected.numeroSendpulse.numero}</span>
              </div>
            )}
            {selected.notas && (
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">Notas</span>
                <p className="text-[var(--text-primary)]">{selected.notas}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
