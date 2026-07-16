'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Plus, X, Trash2 } from 'lucide-react'
import type { Demanda, ColunaDemanda, PrioridadeDemanda, UserStory, ItemLink, UsuarioResponsavel } from '@/types'

function gerarId() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11)
}

const COLUNAS: { value: ColunaDemanda; label: string }[] = [
  { value: 'ideias', label: 'Ideias' },
  { value: 'fazendo', label: 'Fazendo' },
  { value: 'revisao', label: 'Revisão' },
  { value: 'concluido', label: 'Concluído' },
]

const PRIORIDADES: { value: PrioridadeDemanda; label: string; cor: string }[] = [
  { value: 'baixa', label: 'Baixa', cor: '#6b7280' },
  { value: 'media', label: 'Media', cor: '#3b82f6' },
  { value: 'alta', label: 'Alta', cor: '#f59e0b' },
  { value: 'urgente', label: 'Urgente', cor: '#ef4444' },
]

interface ModalDemandaProps {
  open: boolean
  onClose: () => void
  demanda?: Demanda | null
  onSave: (demanda: Demanda) => void
  onDelete?: (id: string) => void
  usuarios: Record<string, UsuarioResponsavel>
}

export function ModalDemanda({ open, onClose, demanda, onSave, onDelete, usuarios }: ModalDemandaProps) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [coluna, setColuna] = useState<ColunaDemanda>('ideias')
  const [prioridade, setPrioridade] = useState<PrioridadeDemanda>('media')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [dataCriacao, setDataCriacao] = useState('')
  const [userStories, setUserStories] = useState<UserStory[]>([])
  const [links, setLinks] = useState<ItemLink[]>([])
  const [imagens, setImagens] = useState<string[]>([])
  const [funilIds, setFunilIds] = useState<string[]>([])
  const [numerosSendpulse, setNumerosSendpulse] = useState<string[]>([])
  const [newStoryTitulo, setNewStoryTitulo] = useState('')
  const [newStoryDesc, setNewStoryDesc] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkTitulo, setNewLinkTitulo] = useState('')
  const [newImagemUrl, setNewImagemUrl] = useState('')

  const isEditing = !!demanda

  const resetForm = useCallback(() => {
    setTitulo('')
    setDescricao('')
    setColuna('ideias')
    setPrioridade('media')
    setTags([])
    setTagInput('')
    setResponsavelId('')
    setDataCriacao('')
    setUserStories([])
    setLinks([])
    setImagens([])
    setFunilIds([])
    setNumerosSendpulse([])
    setNewStoryTitulo('')
    setNewStoryDesc('')
    setNewLinkUrl('')
    setNewLinkTitulo('')
    setNewImagemUrl('')
  }, [])

  useEffect(() => {
    if (demanda) {
      setTitulo(demanda.titulo)
      setDescricao(demanda.descricao ?? '')
      setColuna(demanda.coluna)
      setPrioridade(demanda.prioridade)
      setTags(demanda.tags ?? [])
      setResponsavelId(demanda.responsavelId ?? '')
      setDataCriacao(demanda.dataCriacao ?? '')
      setUserStories(demanda.userStories ?? [])
      setLinks(demanda.links ?? [])
      setImagens(demanda.imagens ?? [])
      setFunilIds(demanda.funilIds ?? [])
      setNumerosSendpulse(demanda.numerosSendpulse ?? [])
    } else {
      resetForm()
    }
  }, [demanda, resetForm])

  function handleSave() {
    if (!titulo.trim()) return
    const now = new Date().toISOString()
    const payload: Demanda = demanda
      ? { ...demanda, titulo: titulo.trim(), descricao, coluna, prioridade, tags, responsavelId: responsavelId || undefined, dataCriacao, userStories, links, imagens, funilIds, numerosSendpulse, atualizadoEm: now }
      : { id: gerarId(), titulo: titulo.trim(), descricao, coluna, ordem: 0, prioridade, tags: tags ?? [], responsavelId: responsavelId || undefined, dataCriacao: dataCriacao || now, userStories: userStories ?? [], links: links ?? [], imagens: imagens ?? [], funilIds: funilIds ?? [], numerosSendpulse: numerosSendpulse ?? [], criadoEm: now, atualizadoEm: now }
    onSave(payload)
  }

  function addTag() {
    const val = tagInput.trim()
    if (val && !tags.includes(val)) {
      setTags([...tags, val])
      setTagInput('')
    }
  }

  function addStory() {
    if (!newStoryTitulo.trim()) return
    setUserStories([...userStories, { id: gerarId(), titulo: newStoryTitulo.trim(), descricao: newStoryDesc.trim() || undefined, concluido: false }])
    setNewStoryTitulo('')
    setNewStoryDesc('')
  }

  function addLink() {
    if (!newLinkUrl.trim() || !newLinkTitulo.trim()) return
    setLinks([...links, { url: newLinkUrl.trim(), titulo: newLinkTitulo.trim() }])
    setNewLinkUrl('')
    setNewLinkTitulo('')
  }

  function addImagem() {
    if (!newImagemUrl.trim()) return
    setImagens([...imagens, newImagemUrl.trim()])
    setNewImagemUrl('')
  }

  const usuariosList = Object.values(usuarios)

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar Demanda' : 'Nova Demanda'} width="640px">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Titulo</label>
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Titulo da demanda" className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors" />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Descricao</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descricao da demanda..." rows={3} className="w-full px-3 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Coluna</label>
            <select value={coluna} onChange={(e) => setColuna(e.target.value as ColunaDemanda)} className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors">
              {COLUNAS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Prioridade</label>
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeDemanda)} className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors">
              {PRIORIDADES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)]">
                {tag}
                <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="+ tag..." className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono" />
            <Button size="sm" variant="ghost" onClick={addTag} disabled={!tagInput.trim()}><Plus size={12} /></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Responsavel</label>
            <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors">
              <option value="">Nenhum</option>
              {usuariosList.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Data de Criacao</label>
            <input type="date" value={dataCriacao ? dataCriacao.slice(0, 10) : ''} onChange={(e) => setDataCriacao(e.target.value + 'T00:00:00.000Z')} className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5">User Stories</label>
          <div className="space-y-1 mb-2">
            {userStories.map((story) => (
              <div key={story.id} className="flex items-start gap-2 p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
                <input type="checkbox" checked={story.concluido} onChange={() => setUserStories(userStories.map((s) => s.id === story.id ? { ...s, concluido: !s.concluido } : s))} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium ${story.concluido ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{story.titulo}</span>
                  {story.descricao && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{story.descricao}</p>}
                </div>
                <button onClick={() => setUserStories(userStories.filter((s) => s.id !== story.id))} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <input type="text" value={newStoryTitulo} onChange={(e) => setNewStoryTitulo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStory() } }} placeholder="Titulo da etapa..." className="w-full h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono" />
            <input type="text" value={newStoryDesc} onChange={(e) => setNewStoryDesc(e.target.value)} placeholder="Descricao (opcional)..." className="w-full h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono" />
            <Button size="sm" variant="ghost" onClick={addStory} disabled={!newStoryTitulo.trim()}><Plus size={12} /> Adicionar etapa</Button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5">Links</label>
          <div className="space-y-1 mb-2">
            {links.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-[var(--d1)] hover:underline truncate">{link.titulo}</a>
                <button onClick={() => setLinks(links.filter((_, i) => i !== idx))} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input type="text" value={newLinkTitulo} onChange={(e) => setNewLinkTitulo(e.target.value)} placeholder="Titulo..." className="w-1/3 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono" />
            <input type="text" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} placeholder="URL..." className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono" />
            <Button size="sm" variant="ghost" onClick={addLink} disabled={!newLinkUrl.trim() || !newLinkTitulo.trim()}><Plus size={12} /></Button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5">Imagens</label>
          <div className="space-y-1 mb-2">
            {imagens.map((img, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
                <img src={img} alt="" className="w-12 h-12 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <span className="flex-1 text-[10px] text-[var(--text-muted)] font-mono truncate">{img}</span>
                <button onClick={() => setImagens(imagens.filter((_, i) => i !== idx))} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input type="text" value={newImagemUrl} onChange={(e) => setNewImagemUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImagem() } }} placeholder="URL da imagem..." className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono" />
            <Button size="sm" variant="ghost" onClick={addImagem} disabled={!newImagemUrl.trim()}><Plus size={12} /></Button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Vinculacoes</label>
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Funis</label>
              <input type="text" value={funilIds.join(', ')} onChange={(e) => setFunilIds(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="Nomes dos funis separados por virgula" className="w-full h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono" />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Numeros SendPulse (IDs)</label>
              <input type="text" value={numerosSendpulse.join(', ')} onChange={(e) => setNumerosSendpulse(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="IDs separados por virgula" className="w-full h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
        <div>
          {isEditing && onDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(demanda.id)}>
              <Trash2 size={12} /> Excluir
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={!titulo.trim()}>
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
