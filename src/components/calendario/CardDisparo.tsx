'use client'

import { useState } from 'react'
import type { Disparo, StatusDisparo } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useEsteiras } from '@/hooks/useEsteiras'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { StatusDot } from '../ui/StatusDot'
import { Modal } from '../ui/Modal'
import { Dropdown } from '../ui/Dropdown'
import { useToast } from '../ui/Toast'
import { ExternalLink, Trash2, Play, Check } from 'lucide-react'
import Link from 'next/link'

const TIPO_CORES: Record<string, string> = {
  D1: 'var(--d1)',
  D3: 'var(--d3)',
  D5: 'var(--d5)',
  D7: 'var(--d7)',
  PONTUAL: 'var(--pontual)',
}

const STATUS_DISPONIVEIS: { value: StatusDisparo; label: string }[] = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'pronto', label: 'Pronto' },
  { value: 'em_validacao', label: 'Em Validação' },
  { value: 'executado', label: 'Executado' },
  { value: 'cancelado', label: 'Cancelado' },
]

interface CardDisparoProps {
  disparo: Disparo
}

export function CardDisparo({ disparo }: CardDisparoProps) {
  const [open, setOpen] = useState(false)
  const { update, remove } = useDisparos()
  const { getById } = useEsteiras()
  const { casas } = useCasasAposta()
  const { addToast } = useToast()

  const cor = TIPO_CORES[disparo.tipo] ?? 'var(--text-secondary)'
  const esteira = disparo.esteiraPaiId ? getById(disparo.esteiraPaiId) : null

  function handleStatusChange(status: StatusDisparo) {
    update(disparo.id, { status })
    addToast('success', `Status alterado para ${status.replace('_', ' ')}`)
  }

  function handleExecutar() {
    update(disparo.id, { status: 'executado' })
    addToast('success', `${disparo.tipo} marcado como executado`)
    setOpen(false)
  }

  function handleDelete() {
    if (confirm('Tem certeza que deseja apagar este disparo?')) {
      remove(disparo.id)
      addToast('success', 'Disparo removido')
      setOpen(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded p-2.5 transition-all duration-150 group"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${cor}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold" style={{ color: cor }}>
            {disparo.tipo}
          </span>
          {disparo.status !== 'executado' && disparo.status !== 'cancelado' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                handleExecutar()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  handleExecutar()
                }
              }}
              className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity border border-[var(--border)] text-[var(--d1)] hover:bg-[var(--d1)]/10 cursor-pointer"
              title="Executar agora"
            >
              <Play size={10} />
              Executar
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-1">
          {disparo.casasAposta.map((casaId) => {
            const casa = casas[casaId]
            if (!casa) return null
            return <Chip key={casaId} label={casa.nome} cor={casa.cor} size="sm" />
          })}
        </div>

        <p className="font-mono text-[11px] text-[var(--text-secondary)] truncate mb-1">
          {disparo.nomenclatura}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span>{disparo.horarioDisparo}</span>
          <span>·</span>
          <StatusDot status={disparo.status} size={6} />
          <span className="capitalize">{disparo.status.replace('_', ' ')}</span>
        </div>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={disparo.nomenclatura}>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Tipo</span>
              <Badge variant="tipo" value={disparo.tipo} />
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Status</span>
              <Dropdown label={disparo.status.replace('_', ' ')}>
                <div className="p-1 min-w-[140px]">
                  {STATUS_DISPONIVEIS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        handleStatusChange(opt.value)
                        setOpen(false)
                      }}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded transition-colors ${
                        opt.value === disparo.status
                          ? 'text-[var(--d1)] bg-[var(--d1)]/10'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      {opt.value === disparo.status && <Check size={14} className="text-[var(--d1)]" />}
                      <span className={opt.value === disparo.status ? '' : 'ml-6'}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </Dropdown>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Data</span>
              <span className="text-[var(--text-primary)]">{disparo.dataDisparo}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Horário</span>
              <span className="text-[var(--text-primary)]">{disparo.horarioDisparo}</span>
            </div>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block text-xs mb-1">Casas de Aposta</span>
            <div className="flex flex-wrap gap-1">
              {disparo.casasAposta.map((casaId) => {
                const casa = casas[casaId]
                if (!casa) return null
                return <Chip key={casaId} label={casa.nome} cor={casa.cor} size="md" />
              })}
            </div>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block text-xs mb-1">Base CSV</span>
            <span className="text-[var(--text-primary)]">{disparo.base.status}</span>
            {disparo.base.nomeArquivo && (
              <span className="text-[var(--text-secondary)] ml-2">({disparo.base.nomeArquivo})</span>
            )}
          </div>

          {disparo.notas && (
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Notas</span>
              <p className="text-[var(--text-primary)]">{disparo.notas}</p>
            </div>
          )}

          {esteira && disparo.tipo === 'D1' && (
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Esteira</span>
              <Link href="/esteiras" className="text-[var(--d1)] text-xs hover:underline">
                Ver esteira completa
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-[var(--border)]">
          {disparo.status !== 'executado' && disparo.status !== 'cancelado' && (
            <Button variant="primary" size="sm" icon={<Play size={14} />} onClick={handleExecutar}>
              Executar
            </Button>
          )}
          <Link href={`/disparos/${disparo.id}`}>
            <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
              Detalhes
            </Button>
          </Link>
          <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleDelete}>
            Excluir
          </Button>
        </div>
      </Modal>
    </>
  )
}
