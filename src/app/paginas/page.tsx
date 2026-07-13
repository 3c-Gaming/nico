'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Plus, RefreshCw, Trash2, Pencil, ExternalLink, Phone, Hash, Weight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Destination {
  phone: string
  flowId: string
  weight: number
}

interface Pagina {
  id: string
  nome: string
  github_owner: string
  github_repo: string
  destinations: Destination[]
  text: string
  updated_at: string
}

export default function PaginasPage() {
  const [paginas, setPaginas] = useState<Pagina[]>([])
  const [loading, setLoading] = useState(true)
  const [modalCadastro, setModalCadastro] = useState(false)
  const [modalEdicao, setModalEdicao] = useState(false)
  const [paginaSelecionada, setPaginaSelecionada] = useState<Pagina | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form cadastro
  const [novoNome, setNovoNome] = useState('')
  const [novoOwner, setNovoOwner] = useState('3c-Gaming')
  const [novoRepo, setNovoRepo] = useState('')

  // Form edição
  const [editDestinations, setEditDestinations] = useState<Destination[]>([])
  const [editText, setEditText] = useState('')

  const carregarPaginas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/paginas')
      const json = await res.json()
      setPaginas(json.paginas ?? [])
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { carregarPaginas() }, [carregarPaginas])

  // Cadastrar nova página
  async function cadastrar() {
    if (!novoNome || !novoRepo) return
    setSaving(true)
    try {
      const res = await fetch('/api/paginas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          nome: novoNome,
          github_owner: novoOwner,
          github_repo: novoRepo,
          destinations: [],
          text: '',
          updated_at: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        setModalCadastro(false)
        setNovoNome('')
        setNovoRepo('')
        await carregarPaginas()
      }
    } catch { /* empty */ }
    setSaving(false)
  }

  // Sincronizar DESTINATIONS do GitHub
  async function sincronizar(pagina: Pagina) {
    setSyncing(pagina.id)
    try {
      const res = await fetch('/api/paginas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: pagina.github_owner, repo: pagina.github_repo }),
      })
      const json = await res.json()
      if (res.ok) {
        // Salvar no Supabase
        await fetch('/api/paginas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: pagina.id,
            destinations: json.destinations,
            text: json.text,
          }),
        })
        await carregarPaginas()
      }
    } catch { /* empty */ }
    setSyncing(null)
  }

  // Abrir modal de edição
  function abrirEdicao(pagina: Pagina) {
    setPaginaSelecionada(pagina)
    setEditDestinations(pagina.destinations?.length ? [...pagina.destinations] : [{ phone: '', flowId: '', weight: 100 }])
    setEditText(pagina.text ?? '')
    setModalEdicao(true)
  }

  // Salvar edição (commit no GitHub + update Supabase)
  async function salvarEdicao() {
    if (!paginaSelecionada) return
    setSaving(true)
    try {
      // 1. Commit no GitHub
      const res = await fetch('/api/paginas/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: paginaSelecionada.github_owner,
          repo: paginaSelecionada.github_repo,
          destinations: editDestinations,
          text: editText,
        }),
      })

      if (res.ok) {
        // 2. Atualizar no Supabase
        await fetch('/api/paginas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: paginaSelecionada.id,
            destinations: editDestinations,
            text: editText,
          }),
        })
        setModalEdicao(false)
        await carregarPaginas()
      }
    } catch { /* empty */ }
    setSaving(false)
  }

  // Deletar página
  async function deletar(id: string) {
    if (!confirm('Remover esta página?')) return
    await fetch(`/api/paginas?id=${id}`, { method: 'DELETE' })
    await carregarPaginas()
  }

  // Editar destination na lista
  function updateDest(index: number, field: keyof Destination, value: string | number) {
    setEditDestinations(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d))
  }

  function addDest() {
    setEditDestinations(prev => [...prev, { phone: '', flowId: '', weight: 0 }])
  }

  function removeDest(index: number) {
    setEditDestinations(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <>
      <PageHeader
        titulo="Páginas"
        descricao="Gerenciamento de landing pages e tracking WhatsApp"
        icon={<FileText size={20} className="text-[var(--text-secondary)]" />}
        acoes={
          <Button icon={<Plus size={16} />} size="sm" onClick={() => setModalCadastro(true)}>
            Adicionar Página
          </Button>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-muted)] text-sm">
            Carregando...
          </div>
        ) : paginas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText size={48} className="text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">Nenhuma página cadastrada</p>
            <Button icon={<Plus size={16} />} size="sm" onClick={() => setModalCadastro(true)}>
              Cadastrar Primeira Página
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginas.map(pagina => (
              <div
                key={pagina.id}
                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--border-strong)] transition-colors"
              >
                {/* Header do card */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-[var(--d1)]" />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{pagina.nome}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => sincronizar(pagina)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title="Sincronizar do GitHub"
                    >
                      <RefreshCw size={14} className={syncing === pagina.id ? 'animate-spin' : ''} />
                    </button>
                    <button
                      onClick={() => abrirEdicao(pagina)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <a
                      href={`https://github.com/${pagina.github_owner}/${pagina.github_repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title="Ver no GitHub"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => deletar(pagina.id)}
                      className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Repo info */}
                <p className="text-xs text-[var(--text-muted)] font-mono mb-3">
                  {pagina.github_owner}/{pagina.github_repo}
                </p>

                {/* Text */}
                {pagina.text && (
                  <p className="text-xs text-[var(--text-secondary)] mb-3 truncate" title={pagina.text}>
                    💬 {pagina.text}
                  </p>
                )}

                {/* Destinations */}
                {pagina.destinations?.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)] font-medium">Destinos:</p>
                    {pagina.destinations.map((dest, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-[var(--bg-elevated)] rounded px-2.5 py-1.5">
                        <Phone size={12} className="text-[var(--d7)] flex-shrink-0" />
                        <span className="font-mono text-[var(--text-primary)]">{dest.phone}</span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <Hash size={12} className="text-[var(--d3)] flex-shrink-0" />
                        <span className="font-mono text-[var(--text-secondary)] truncate" title={dest.flowId}>
                          {dest.flowId.slice(0, 8)}...
                        </span>
                        <span className="ml-auto text-[var(--d5)] font-semibold">{dest.weight}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic">
                    Sem destinos — clique em ↻ para sincronizar
                  </p>
                )}

                {/* Updated at */}
                {pagina.updated_at && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-3">
                    Atualizado: {new Date(pagina.updated_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Cadastro */}
      <Modal open={modalCadastro} onClose={() => setModalCadastro(false)} title="Nova Página" width="420px">
        <div className="space-y-4">
          <Input label="Nome da Página" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: F14-25 Pilhado" />
          <Input label="GitHub Owner" value={novoOwner} onChange={e => setNovoOwner(e.target.value)} placeholder="3c-Gaming" />
          <Input label="GitHub Repo" value={novoRepo} onChange={e => setNovoRepo(e.target.value)} placeholder="f14_25" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setModalCadastro(false)}>Cancelar</Button>
            <Button size="sm" onClick={cadastrar} loading={saving} disabled={!novoNome || !novoRepo}>Cadastrar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Edição */}
      <Modal open={modalEdicao} onClose={() => setModalEdicao(false)} title={`Editar — ${paginaSelecionada?.nome}`} width="600px">
        <div className="space-y-4">
          {/* TEXT */}
          <Input
            label="Mensagem WhatsApp (TEXT)"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            placeholder="Ex: Quero entrar no grupo..."
          />

          {/* DESTINATIONS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[var(--text-secondary)] font-medium">Destinos (DESTINATIONS)</label>
              <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addDest}>Adicionar</Button>
            </div>

            <div className="space-y-3">
              {editDestinations.map((dest, i) => (
                <div key={i} className="flex items-end gap-2 bg-[var(--bg-elevated)] rounded-lg p-3">
                  <div className="flex-1">
                    <Input
                      label="Telefone"
                      value={dest.phone}
                      onChange={e => updateDest(i, 'phone', e.target.value)}
                      placeholder="5511999999999"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Flow ID"
                      value={dest.flowId}
                      onChange={e => updateDest(i, 'flowId', e.target.value)}
                      placeholder="abc123..."
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      label="Peso %"
                      type="number"
                      value={String(dest.weight)}
                      onChange={e => updateDest(i, 'weight', Number(e.target.value))}
                      placeholder="100"
                    />
                  </div>
                  {editDestinations.length > 1 && (
                    <button
                      onClick={() => removeDest(i)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors mb-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Soma dos pesos */}
            {editDestinations.length > 0 && (
              <p className={`text-xs mt-2 ${editDestinations.reduce((s, d) => s + d.weight, 0) === 100 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                Soma dos pesos: {editDestinations.reduce((s, d) => s + d.weight, 0)}% {editDestinations.reduce((s, d) => s + d.weight, 0) !== 100 && '(deve ser 100%)'}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button variant="ghost" size="sm" onClick={() => setModalEdicao(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvarEdicao} loading={saving}>
              Salvar e Commitar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
