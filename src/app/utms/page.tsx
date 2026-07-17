'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Chip } from '@/components/ui/Chip'
import { useUtmConfigs } from '@/hooks/useUtmConfigs'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'

export default function UtmsPage() {
  const { list, add, update, remove } = useUtmConfigs()
  const { casas } = useCasasAposta()
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [casa, setCasa] = useState<'superbet' | 'betmgm'>('superbet')
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const superbetList = useMemo(() => list.filter((u) => u.casa === 'superbet'), [list])
  const betmgmList = useMemo(() => list.filter((u) => u.casa === 'betmgm'), [list])

  function handleAdd() {
    if (!nome.trim() || !valor.trim()) return
    add({ nome: nome.trim(), valor: valor.trim(), casa })
    setNome('')
    setValor('')
  }

  function handleSaveEdit(id: string) {
    if (!nome.trim() || !valor.trim()) return
    update(id, { nome: nome.trim(), valor: valor.trim(), casa })
    setEditandoId(null)
    setNome('')
    setValor('')
  }

  function handleEdit(item: { id: string; nome: string; valor: string; casa: 'superbet' | 'betmgm' }) {
    setEditandoId(item.id)
    setNome(item.nome)
    setValor(item.valor)
    setCasa(item.casa)
  }

  function handleCancelEdit() {
    setEditandoId(null)
    setNome('')
    setValor('')
    setCasa('superbet')
  }

  function renderList(items: { id: string; nome: string; valor: string; casa: 'superbet' | 'betmgm' }[], label: string, cor: string) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{label}</h3>
        <div className="space-y-2">
          {items.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">Nenhum cadastrado</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
              <div className="flex items-center gap-3">
                <Chip label={item.casa === 'superbet' ? 'SB' : 'MGM'} cor={cor} size="sm" />
                <div>
                  <span className="text-sm text-[var(--text-primary)]">{item.nome}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-2 font-mono">{item.valor}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(item)} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]">
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(item.id)} className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader titulo="UTMs / PIDs" descricao="Cadastro de UTMs (Superbet) e PIDs (BetMGM)" />
      <div className="p-6 max-w-2xl">
        <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] rounded-md p-5 mb-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            {editandoId ? 'Editar' : 'Nova'} Configuração
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Nome"
                placeholder="ex: superbet_junho_d1"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <Input
                label="Valor"
                placeholder={casa === 'superbet' ? 'ex: superbet_junho_d1' : 'ex: 13382'}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              <Select
                label="Casa"
                value={casa}
                options={[
                  { value: 'superbet', label: 'Superbet (UTM)' },
                  { value: 'betmgm', label: 'BetMGM (PID)' },
                ]}
                onChange={(e) => setCasa(e.target.value as 'superbet' | 'betmgm')}
              />
            </div>
            <div className="flex gap-2">
              {editandoId ? (
                <>
                  <Button size="sm" icon={<Check size={14} />} onClick={() => handleSaveEdit(editandoId)}>
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button size="sm" icon={<Plus size={14} />} onClick={handleAdd}>
                  Adicionar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {renderList(superbetList, 'UTMs — Superbet', '#22c55e')}
          {renderList(betmgmList, 'PIDs — BetMGM', '#6366f1')}
        </div>
      </div>
    </>
  )
}
