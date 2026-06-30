'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useCasasAposta, gerarCor, slugify } from '@/hooks/useCasasAposta'
import { useToast } from '@/components/ui/Toast'
import {
  Pencil, Trash2, Plus, Variable, Link as LinkIcon, DollarSign, X, Layers,
  ImageUp, ImageOff, Loader2, Upload
} from 'lucide-react'
import Link from 'next/link'
import type { CasaAposta, PainelCPA } from '@/types'

const PRESET_CORES = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#E11D48', '#7C3AED', '#059669', '#D97706',
]

export default function CasasPage() {
  const { list, add, update, remove, allFunilNames, uploadLogo, removeLogo } = useCasasAposta()
  const { addToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('')
  const [slug, setSlug] = useState('')
  const [logo, setLogo] = useState('')
  const [variaveis, setVariaveis] = useState<[string, string][]>([])
  const [paineisCPA, setPaineisCPA] = useState<PainelCPA[]>([])
  const [funilIds, setFunilIds] = useState<string[]>([])
  const [funilInput, setFunilInput] = useState('')
  const [funilSugestoesAberto, setFunilSugestoesAberto] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const funilRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [logoHover, setLogoHover] = useState<string | null>(null)

  const funilSugestoes = useMemo(() => {
    if (!funilInput.trim()) return []
    const q = funilInput.toLowerCase()
    return allFunilNames.filter((f) => f.toLowerCase().includes(q) && !funilIds.includes(f))
  }, [funilInput, allFunilNames, funilIds])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (funilRef.current && !funilRef.current.contains(e.target as Node)) {
        setFunilSugestoesAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openNew() {
    setEditId(null)
    setNome('')
    setCor('#3B82F6')
    setSlug('')
    setLogo('')
    setVariaveis([])
    setPaineisCPA([])
    setFunilIds([])
    setFunilInput('')
    setModalOpen(true)
  }

  function openEdit(casa: { id: string; nome: string; cor: string; slug: string; logo?: string; variaveis?: Record<string, string>; paineisCPA?: PainelCPA[]; funilIds?: string[] }) {
    setEditId(casa.id)
    setNome(casa.nome)
    setCor(casa.cor)
    setSlug(casa.slug)
    setLogo(casa.logo ?? '')
    setVariaveis(Object.entries(casa.variaveis ?? {}))
    setPaineisCPA(casa.paineisCPA ? [...casa.paineisCPA] : [])
    setFunilIds(casa.funilIds ? [...casa.funilIds] : [])
    setFunilInput('')
    setModalOpen(true)
  }

  function addFunil(nome: string) {
    const val = nome.trim()
    if (val && !funilIds.includes(val)) {
      setFunilIds([...funilIds, val])
    }
    setFunilInput('')
    setFunilSugestoesAberto(false)
  }

  function removeFunil(id: string) {
    setFunilIds(funilIds.filter((f) => f !== id))
  }

  function handleFunilKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addFunil(funilInput) }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const slugAtual = slug.trim() || slugify(nome)
    setUploadLoading(true)
    try {
      const logoPath = await uploadLogo(file, slugAtual)
      setLogo(logoPath)
      addToast('success', 'Logo enviado')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao fazer upload')
    } finally {
      setUploadLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveLogo() {
    const slugAtual = slug.trim() || slugify(nome)
    try {
      await removeLogo(slugAtual)
      setLogo('')
      addToast('success', 'Logo removido')
    } catch {
      addToast('error', 'Erro ao remover logo')
    }
  }

  function handleSave() {
    if (!nome.trim()) {
      addToast('warning', 'Nome é obrigatório')
      return
    }

    const varsObj: Record<string, string> = {}
    for (const [k, v] of variaveis) {
      if (k.trim()) varsObj[k.trim()] = v
    }

    const data: Partial<CasaAposta> = {
      nome: nome.trim(),
      slug: slug.trim() || slugify(nome),
      cor,
      logo: logo || undefined,
      variaveis: varsObj,
      paineisCPA,
      funilIds,
    }

    if (editId) {
      update(editId, data)
      addToast('success', 'Casa atualizada')
    } else {
      const casa = add(nome.trim())
      if (casa) {
        update(casa.id, { ...data, slug: slug.trim() || slugify(nome) })
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

  function addVariavel() {
    setVariaveis((prev) => [...prev, ['', '']])
  }

  function updateVariavel(index: number, field: 0 | 1, value: string) {
    setVariaveis((prev) => {
      const next = [...prev]
      next[index] = [...next[index]] as [string, string]
      next[index][field] = value
      return next
    })
  }

  function removeVariavel(index: number) {
    setVariaveis((prev) => prev.filter((_, i) => i !== index))
  }

  function addPainel() {
    setPaineisCPA((prev) => [...prev, { id: crypto.randomUUID(), nome: '', valorCPA: 0 }])
  }

  function updatePainel(index: number, field: 'nome' | 'valorCPA', value: string | number) {
    setPaineisCPA((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function removePainel(index: number) {
    setPaineisCPA((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <>
      <div className="flex items-center gap-1 px-6 pt-4 pb-0">
        <Link
          href="/casas"
          className="px-3 py-1.5 text-xs font-medium rounded transition-colors text-[var(--text-primary)] bg-[var(--bg-elevated)]"
        >
          Casas
        </Link>
        <Link
          href="/casas/links"
          className="px-3 py-1.5 text-xs font-medium rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Links
        </Link>
      </div>

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
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {list.map((casa) => {
            const vars = Object.entries(casa.variaveis ?? {})
            const totalFunis = casa.funilIds?.length ?? 0
            const funisExibidos = casa.funilIds?.slice(0, 3) ?? []
            const funisRestantes = totalFunis - funisExibidos.length

            return (
              <div
                key={casa.id}
                className="group flex flex-col rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:shadow-sm transition-all overflow-hidden"
              >
                <div className="h-1 flex-shrink-0" style={{ backgroundColor: casa.cor }} />

                <div className="flex flex-col items-center p-5 text-center flex-1">
                  <div
                    className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 mb-3"
                    onMouseEnter={() => setLogoHover(casa.id)}
                    onMouseLeave={() => setLogoHover(null)}
                  >
                    {casa.logo ? (
                      <>
                        <img
                          src={casa.logo}
                          alt={casa.nome}
                          className="w-full h-full object-contain"
                        />
                        {logoHover === casa.id && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                            <Pencil
                              size={16}
                              className="text-white cursor-pointer"
                              onClick={() => openEdit(casa)}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-lg font-bold text-white rounded-full"
                        style={{ backgroundColor: casa.cor }}
                      >
                        {casa.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <span className="text-sm font-semibold text-[var(--text-primary)] block truncate max-w-full">
                    {casa.nome}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono block mt-0.5">
                    @{casa.slug}
                  </span>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                    {totalFunis > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--d1)]/10 text-[var(--d1)]">
                        <Layers size={11} />
                        {totalFunis} funil
                      </span>
                    )}
                    {(casa.paineisCPA?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--d7)]/10 text-[var(--d7)]">
                        <DollarSign size={11} />
                        {casa.paineisCPA.length} CPA
                      </span>
                    )}
                    {vars.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--d5)]/10 text-[var(--d5)]">
                        <Variable size={11} />
                        {vars.length} var
                      </span>
                    )}
                  </div>

                  {funisExibidos.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mt-2.5">
                      {funisExibidos.map((fid) => (
                        <span
                          key={fid}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)]"
                        >
                          {fid}
                        </span>
                      ))}
                      {funisRestantes > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-base)] text-[var(--text-muted)]">
                          +{funisRestantes}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center border-t border-[var(--border)] divide-x divide-[var(--border)]">
                  <Link
                    href="/casas/links"
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <LinkIcon size={13} />
                    Links
                  </Link>
                  <button
                    onClick={() => openEdit(casa)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <Pencil size={13} />
                    Editar
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(casa.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error)]/5 transition-colors"
                  >
                    <Trash2 size={13} />
                    Excluir
                  </button>
                </div>
              </div>
            )
          })}

          {list.length === 0 && (
            <div className="col-span-full text-center py-16 text-[var(--text-muted)] text-sm">
              Nenhuma casa cadastrada
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Casa' : 'Nova Casa'}
        width="520px"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)]">
                {logo ? (
                  <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-base font-bold text-white"
                    style={{ backgroundColor: cor }}
                  >
                    {nome ? nome.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
                {uploadLoading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-white" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2">
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
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)] font-medium">Logo</span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className="flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium rounded border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  {uploadLoading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {uploadLoading ? 'Enviando...' : 'Enviar imagem'}
                </label>
                {logo && (
                  <button
                    onClick={handleRemoveLogo}
                    className="flex items-center gap-1 px-2 h-7 text-xs font-medium rounded border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                  >
                    <ImageOff size={12} />
                    Remover
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Formatos aceitos: PNG, JPG, WebP, SVG. Tamanho ideal: 200x200px.
            </p>
          </div>

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

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                <Layers size={12} className="inline mr-1" />
                Funis
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2" ref={funilRef}>
              {funilIds.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--d1)]/10 text-[var(--d1)]">
                  {id}
                  <button onClick={() => removeFunil(id)} className="hover:text-[var(--error)] transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <div className="relative">
                <input
                  type="text"
                  value={funilInput}
                  onChange={(e) => { setFunilInput(e.target.value); setFunilSugestoesAberto(true) }}
                  onKeyDown={handleFunilKeyDown}
                  placeholder={funilIds.length === 0 ? 'Digite ou selecione um funil...' : '+ Adicionar'}
                  className="h-6 min-w-[120px] px-2 text-xs bg-transparent border border-dashed border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
                />
                {funilSugestoesAberto && funilSugestoes.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                    {funilSugestoes.map((nome) => (
                      <button
                        key={nome}
                        onClick={() => addFunil(nome)}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--d1)]/10 transition-colors"
                      >
                        {nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Variáveis <span className="text-[var(--text-muted)]">(usadas nos links como {'{{nome}}'})</span>
              </span>
              <button
                onClick={addVariavel}
                className="text-xs text-[var(--d1)] hover:underline"
              >
                + Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {variaveis.map(([chave, valor], i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="chave"
                    value={chave}
                    onChange={(e) => updateVariavel(i, 0, e.target.value)}
                    className="flex-1 h-8 px-2.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
                  />
                  <span className="text-[var(--text-muted)] text-xs">=</span>
                  <input
                    type="text"
                    placeholder="valor"
                    value={valor}
                    onChange={(e) => updateVariavel(i, 1, e.target.value)}
                    className="flex-[2] h-8 px-2.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
                  />
                  <button
                    onClick={() => removeVariavel(i)}
                    className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {variaveis.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">Nenhuma variável definida</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Painéis de CPA
              </span>
              <button
                onClick={addPainel}
                className="text-xs text-[var(--d1)] hover:underline"
              >
                + Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {paineisCPA.map((painel, i) => (
                <div key={painel.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nome (ex: Painel 500)"
                    value={painel.nome}
                    onChange={(e) => updatePainel(i, 'nome', e.target.value)}
                    className="flex-1 h-8 px-2.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--text-muted)] text-xs">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={painel.valorCPA || ''}
                      onChange={(e) => updatePainel(i, 'valorCPA', parseFloat(e.target.value) || 0)}
                      className="w-24 h-8 px-2.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] text-right"
                    />
                  </div>
                  <button
                    onClick={() => removePainel(i)}
                    className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {paineisCPA.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">Nenhum painel de CPA configurado</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-[var(--border)] flex-shrink-0">
              {logo ? (
                <img src={logo} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: cor }}
                >
                  {nome ? nome.charAt(0).toUpperCase() : '?'}
                </div>
              )}
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
