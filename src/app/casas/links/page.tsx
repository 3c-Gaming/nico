'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useLinkTemplates, renderLinkTemplate } from '@/hooks/useLinkTemplates'
import { useToast } from '@/components/ui/Toast'
import { Plus, Pencil, Trash2, Copy, Link as LinkIcon } from 'lucide-react'
import type { TipoDisparo, LinkTemplate } from '@/types'
import Link from 'next/link'

const TIPOS: TipoDisparo[] = ['D1', 'D3', 'D5', 'D7', 'PONTUAL']

export default function LinksPage() {
  const { list: casasList } = useCasasAposta()
  const { list, add, update, remove } = useLinkTemplates()
  const { addToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [casaId, setCasaId] = useState('')
  const [urlTemplate, setUrlTemplate] = useState('')
  const [tipos, setTipos] = useState<TipoDisparo[]>([])

  function openNew() {
    setEditId(null)
    setNome('')
    setCasaId(casasList[0]?.id ?? '')
    setUrlTemplate('')
    setTipos([])
    setModalOpen(true)
  }

  function openEdit(t: LinkTemplate) {
    setEditId(t.id)
    setNome(t.nome)
    setCasaId(t.casaId)
    setUrlTemplate(t.urlTemplate)
    setTipos([...t.tipos])
    setModalOpen(true)
  }

  function handleSave() {
    if (!nome.trim() || !urlTemplate.trim() || !casaId) {
      addToast('warning', 'Preencha nome, casa e URL')
      return
    }
    if (tipos.length === 0) {
      addToast('warning', 'Selecione ao menos um tipo')
      return
    }

    const agora = new Date().toISOString()

    if (editId) {
      update(editId, { nome: nome.trim(), casaId, urlTemplate: urlTemplate.trim(), tipos })
      addToast('success', 'Link atualizado')
    } else {
      add({
        id: crypto.randomUUID(),
        nome: nome.trim(),
        casaId,
        urlTemplate: urlTemplate.trim(),
        tipos,
        criadoEm: agora,
        atualizadoEm: agora,
      })
      addToast('success', 'Link criado')
    }

    setModalOpen(false)
  }

  function handleDelete(id: string) {
    if (confirm('Tem certeza que deseja apagar este template de link?')) {
      remove(id)
      addToast('success', 'Link removido')
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url)
    addToast('success', 'Link copiado')
  }

  function toggleTipo(t: TipoDisparo) {
    setTipos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const casasMap = new Map(casasList.map((c) => [c.id, c]))
  const grouped = casasList
    .map((c) => ({ casa: c, templates: list.filter((t) => t.casaId === c.id) }))
    .filter((g) => g.templates.length > 0)
  const orphanTemplates = list.filter((t) => !casasMap.has(t.casaId))

  return (
    <>
      <div className="flex items-center gap-1 px-6 pt-4 pb-0">
        <Link
          href="/casas"
          className="px-3 py-1.5 text-xs font-medium rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Casas
        </Link>
        <Link
          href="/casas/links"
          className="px-3 py-1.5 text-xs font-medium rounded transition-colors text-[var(--text-primary)] bg-[var(--bg-elevated)]"
        >
          Links
        </Link>
      </div>

      <PageHeader
        titulo="Templates de Link"
        descricao="Gerencie os templates de link associados a cada casa"
        acoes={
          <Button size="sm" onClick={openNew} icon={<Plus size={16} />}>
            Novo Link
          </Button>
        }
      />

      <div className="p-6 space-y-8">
        {grouped.map(({ casa, templates }) => (
          <section key={casa.id}>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: casa.cor }}
              />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{casa.nome}</h2>
              <span className="text-xs text-[var(--text-muted)]">({templates.length})</span>
              {Object.keys(casa.variaveis ?? {}).length > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  · vars: {Object.entries(casa.variaveis ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                </span>
              )}
            </div>

            <div className="grid gap-3">
              {templates.map((t) => {
                const rendered = renderLinkTemplate(t.urlTemplate, casa.variaveis)
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-md glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] hover:bg-[var(--glass-hover-bg)] hover:shadow-[var(--glass-hover-shadow)] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <LinkIcon size={14} className="text-[var(--text-muted)] flex-shrink-0" />
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {t.nome}
                          </span>
                          <div className="flex gap-1">
                            {t.tipos.map((tp) => (
                              <span
                                key={tp}
                                className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                                style={{
                                  backgroundColor:
                                    tp === 'D1' ? 'var(--d1)' :
                                    tp === 'D3' ? 'var(--d3)' :
                                    tp === 'D5' ? 'var(--d5)' :
                                    tp === 'D7' ? 'var(--d7)' : 'var(--pontual)',
                                  color: '#fff',
                                }}
                              >
                                {tp}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs text-[var(--text-muted)] font-mono break-all">
                            Template: {t.urlTemplate}
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-[var(--d1)] font-mono break-all flex-1">
                              {rendered}
                            </code>
                            <button
                              onClick={() => handleCopy(rendered)}
                              className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                              title="Copiar"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(t)}
                          icon={<Pencil size={14} />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(t.id)}
                          icon={<Trash2 size={14} />}
                          className="text-[var(--error)]"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {orphanTemplates.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--error)] mb-3">
              Links órfãos (casa não encontrada)
            </h2>
            <div className="grid gap-3">
              {orphanTemplates.map((t) => (
                <div key={t.id} className="p-4 rounded-md border border-[var(--error)] glass bg-[var(--glass-bg)] shadow-[var(--glass-shadow)]">
                  <span className="text-sm text-[var(--text-primary)]">{t.nome}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {grouped.length === 0 && orphanTemplates.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">
            Nenhum template de link cadastrado. Clique em &quot;Novo Link&quot; para come&ccedil;ar.
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Link' : 'Novo Link'}
        width="520px"
      >
        <div className="space-y-5">
          <Input
            label="Nome"
            placeholder="Ex: Cadastro, Link do Fluxo, Link da ODD"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--text-secondary)] font-medium">Casa</span>
            <select
              value={casaId}
              onChange={(e) => setCasaId(e.target.value)}
              className="h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
            >
              <option value="">Selecione...</option>
              {casasList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              URL Template <span className="text-[var(--text-muted)]">(use {'{{var}}'} para variáveis)</span>
            </span>
            <textarea
              value={urlTemplate}
              onChange={(e) => setUrlTemplate(e.target.value)}
              placeholder="https://wlsuperbet.adsrv.eacdn.com/C.ashx?btag=a_{{siteid}}b_431c_&c={{c}}"
              className="h-20 px-3 py-2 text-sm font-mono bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--text-secondary)] font-medium">Tipos de Disparo</span>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => {
                const isSelected = tipos.includes(t)
                const cor =
                  t === 'D1' ? 'var(--d1)' :
                  t === 'D3' ? 'var(--d3)' :
                  t === 'D5' ? 'var(--d5)' :
                  t === 'D7' ? 'var(--d7)' : 'var(--pontual)'
                return (
                  <label
                    key={t}
                    className="flex items-center gap-1.5 px-2.5 h-8 text-xs rounded cursor-pointer border transition-colors"
                    style={{
                      borderColor: isSelected ? cor : 'var(--border)',
                      backgroundColor: isSelected ? cor + '25' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTipo(t)}
                      className="hidden"
                    />
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cor }} />
                    {t}
                  </label>
                )
              })}
            </div>
          </div>

          {casaId && urlTemplate && (
            <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]">
              <span className="text-xs text-[var(--text-muted)] block mb-1">Preview:</span>
              <code className="text-xs text-[var(--d1)] font-mono break-all">
                {renderLinkTemplate(urlTemplate, casasMap.get(casaId)?.variaveis ?? {})}
              </code>
            </div>
          )}

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
    </>
  )
}
