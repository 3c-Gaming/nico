'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useCasasAposta, gerarCor, slugify } from '@/hooks/useCasasAposta'
import { useToast } from '@/components/ui/Toast'
import { Pencil, Trash2, Plus } from 'lucide-react'

const PRESET_CORES = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#E11D48', '#7C3AED', '#059669', '#D97706',
]

export default function CasasPage() {
  const { list, add, update, remove } = useCasasAposta()
  const { addToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('')
  const [slug, setSlug] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  function openNew() {
    setEditId(null)
    setNome('')
    setCor('#3B82F6')
    setSlug('')
    setModalOpen(true)
  }

  function openEdit(casa: { id: string; nome: string; cor: string; slug: string }) {
    setEditId(casa.id)
    setNome(casa.nome)
    setCor(casa.cor)
    setSlug(casa.slug)
    setModalOpen(true)
  }

  function handleSave() {
    if (!nome.trim()) {
      addToast('warning', 'Nome é obrigatório')
      return
    }

    if (editId) {
      update(editId, {
        nome: nome.trim(),
        slug: slug.trim() || slugify(nome),
        cor,
      })
      addToast('success', 'Casa atualizada')
    } else {
      const casa = add(nome.trim())
      if (casa) {
        update(casa.id, { cor, slug: slug.trim() || slugify(nome) })
        addToast('success', 'Casa criada')
      }
    }

    setModalOpen(false)
  }

  function handleDelete(id: string) {
    remove(id)
    addToast('success', 'Casa removida')
    setDeleteConfirm(null)
  }

  function handleNomeChange(val: string) {
    setNome(val)
    if (!editId) {
      setCor(gerarCor(val))
      setSlug(slugify(val))
    }
  }

  return (
    <>
      <PageHeader
        titulo="Casas de Aposta"
        descricao="Gerencie as casas de aposta disponíveis nos disparos"
        acoes={
          <Button size="sm" onClick={openNew} icon={<Plus size={16} />}>
            Nova Casa
          </Button>
        }
      />

      <div className="p-6">
        <div className="grid gap-3 max-w-2xl">
          {list.map((casa) => (
            <div
              key={casa.id}
              className="flex items-center gap-4 p-4 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] transition-colors group"
            >
              <div
                className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: casa.cor }}
              >
                {casa.nome.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--text-primary)] block truncate">
                  {casa.nome}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {casa.slug} · {casa.cor}
                </span>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(casa)}
                  icon={<Pencil size={14} />}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(casa.id)}
                  icon={<Trash2 size={14} />}
                  className="text-[var(--error)]"
                />
              </div>
            </div>
          ))}

          {list.length === 0 && (
            <div className="text-center py-12 text-[var(--text-muted)] text-sm">
              Nenhuma casa cadastrada
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Casa' : 'Nova Casa'}
        width="440px"
      >
        <div className="space-y-5">
          <Input
            label="Nome"
            placeholder="Ex: SuperBet"
            value={nome}
            onChange={(e) => handleNomeChange(e.target.value)}
          />

          <Input
            label="Slug"
            placeholder="superbet"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />

          <div>
            <span className="text-xs text-[var(--text-secondary)] font-medium block mb-2">
              Cor
            </span>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-[var(--border)] bg-transparent p-0.5"
              />
              <code className="text-xs font-mono text-[var(--text-secondary)]">{cor}</code>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className={`w-7 h-7 rounded-md border-2 transition-all ${
                    cor === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: cor }}
            >
              {nome ? nome.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              {nome || 'Nome da casa'}
              {slug && <span className="text-[var(--text-muted)]"> · {slug}</span>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editId ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Excluir Casa"
        width="380px"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Tem certeza que deseja excluir esta casa? Disparos associados não serão removidos.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
