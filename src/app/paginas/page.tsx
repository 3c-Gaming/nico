'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Plus, RefreshCw, Trash2, Pencil, ExternalLink, Phone, Hash } from 'lucide-react'
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
  lovable_project_id?: string
}

interface Numero {
  id: string
  numero: string
  nome: string
  status: 'ativo' | 'inativo'
}

interface Fluxo {
  id: string
  botId: string
  nome: string
  status: 'ativo' | 'inativo' | 'rascunho'
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
  const [novoLovableId, setNovoLovableId] = useState('')

  // Form edição
  const [editDestinations, setEditDestinations] = useState<Destination[]>([])
  const [editText, setEditText] = useState('')

  // Sendpulse data
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [fluxosPorBot, setFluxosPorBot] = useState<Record<string, Fluxo[]>>({})
  const [loadingFluxos, setLoadingFluxos] = useState<Record<string, boolean>>({})

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

  // Carregar números do Sendpulse
  async function carregarNumeros() {
    try {
      const res = await fetch('/api/sendpulse/numeros')
      const json = await res.json()
      setNumeros(json.numeros ?? [])
    } catch { /* empty */ }
  }

  // Carregar fluxos de um bot específico
  async function carregarFluxos(botId: string) {
    if (fluxosPorBot[botId] || loadingFluxos[botId]) return
    setLoadingFluxos(prev => ({ ...prev, [botId]: true }))
    try {
      const res = await fetch(`/api/sendpulse/fluxos?bot_id=${botId}`)
      const json = await res.json()
      setFluxosPorBot(prev => ({ ...prev, [botId]: json.fluxos ?? [] }))
    } catch { /* empty */ }
    setLoadingFluxos(prev => ({ ...prev, [botId]: false }))
  }

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
          ...(novoLovableId && { lovable_project_id: novoLovableId }),
        }),
      })
      if (res.ok) {
        setModalCadastro(false)
        setNovoNome('')
        setNovoRepo('')
        setNovoLovableId('')
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
    carregarNumeros()
  }

  // Quando seleciona um número, buscar os fluxos daquele bot
  function selecionarNumero(index: number, botId: string) {
    const numero = numeros.find(n => n.id === botId)
    if (!numero) return
    updateDest(index, 'phone', numero.numero)
    updateDest(index, 'flowId', '')
    carregarFluxos(botId)
  }

  // Quando seleciona um fluxo
  function selecionarFluxo(index: number, flowId: string) {
    updateDest(index, 'flowId', flowId)
  }

  // Encontrar o botId de um número pelo phone
  function getBotIdByPhone(phone: string): string | null {
    const numero = numeros.find(n => n.numero === phone)
    return numero?.id ?? null
  }

  // Salvar edição (commit no GitHub + update Supabase)
  async function salvarEdicao() {
    if (!paginaSelecionada) return
    setSaving(true)
    try {
      const res = await fetch('/api/paginas/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: paginaSelecionada.github_owner,
          repo: paginaSelecionada.github_repo,
          destinations: editDestinations,
          text: editText,
          lovable_project_id: paginaSelecionada.lovable_project_id,
        }),
      })

      if (res.ok) {
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
      } else {
        const json = await res.json()
        alert(`Erro ao commitar: ${json.error}`)
      }
    } catch (e: any) {
      alert(`Erro: ${e?.message}`)
    }
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

  const selectClass = 'h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)] transition-colors w-full'

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

                <p className="text-xs text-[var(--text-muted)] font-mono mb-1">
                  {pagina.github_owner}/{pagina.github_repo}
                </p>
                {pagina.lovable_project_id && (
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mb-3">
                    Lovable: {pagina.lovable_project_id.slice(0, 12)}...
                  </p>
                )}
                {!pagina.lovable_project_id && <div className="mb-3" />}

                {pagina.text && (
                  <p className="text-xs text-[var(--text-secondary)] mb-3 truncate" title={pagina.text}>
                    💬 {pagina.text}
                  </p>
                )}

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
          <Input label="Lovable Project ID (opcional)" value={novoLovableId} onChange={e => setNovoLovableId(e.target.value)} placeholder="Ex: abc123-def456" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setModalCadastro(false)}>Cancelar</Button>
            <Button size="sm" onClick={cadastrar} loading={saving} disabled={!novoNome || !novoRepo}>Cadastrar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Edição */}
      <Modal open={modalEdicao} onClose={() => setModalEdicao(false)} title={`Editar — ${paginaSelecionada?.nome}`} width="680px">
        <div className="space-y-4">
          <Input
            label="Mensagem WhatsApp (TEXT)"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            placeholder="Ex: Quero entrar no grupo..."
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[var(--text-secondary)] font-medium">Destinos (DESTINATIONS)</label>
              <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addDest}>Adicionar</Button>
            </div>

            <div className="space-y-3">
              {editDestinations.map((dest, i) => {
                const botId = getBotIdByPhone(dest.phone)
                const fluxos = botId ? fluxosPorBot[botId] ?? [] : []

                // Auto-carregar fluxos se temos o botId
                if (botId && !fluxosPorBot[botId] && !loadingFluxos[botId]) {
                  carregarFluxos(botId)
                }

                return (
                  <div key={i} className="bg-[var(--bg-elevated)] rounded-lg p-3 space-y-2">
                    <div className="flex items-end gap-2">
                      {/* Select Número */}
                      <div className="flex-1">
                        <label className="text-xs text-[var(--text-secondary)] font-medium block mb-1">Número</label>
                        <select
                          className={selectClass}
                          value={botId ?? ''}
                          onChange={e => selecionarNumero(i, e.target.value)}
                        >
                          <option value="">Selecione um número...</option>
                          {numeros.filter(n => n.status === 'ativo').map(n => (
                            <option key={n.id} value={n.id}>
                              {n.nome} ({n.numero})
                            </option>
                          ))}
                          {/* Mostrar inativos separados */}
                          {numeros.filter(n => n.status === 'inativo').length > 0 && (
                            <optgroup label="Inativos">
                              {numeros.filter(n => n.status === 'inativo').map(n => (
                                <option key={n.id} value={n.id}>
                                  {n.nome} ({n.numero})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        {dest.phone && (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">{dest.phone}</span>
                        )}
                      </div>

                      {/* Select Fluxo */}
                      <div className="flex-1">
                        <label className="text-xs text-[var(--text-secondary)] font-medium block mb-1">Fluxo</label>
                        <select
                          className={selectClass}
                          value={dest.flowId}
                          onChange={e => selecionarFluxo(i, e.target.value)}
                          disabled={!botId}
                        >
                          <option value="">{!botId ? 'Selecione um número primeiro' : loadingFluxos[botId] ? 'Carregando...' : 'Selecione um fluxo...'}</option>
                          {fluxos.filter(f => f.status === 'ativo').map(f => (
                            <option key={f.id} value={f.id}>
                              {f.nome}
                            </option>
                          ))}
                          {fluxos.filter(f => f.status !== 'ativo').length > 0 && (
                            <optgroup label="Inativos/Rascunho">
                              {fluxos.filter(f => f.status !== 'ativo').map(f => (
                                <option key={f.id} value={f.id}>
                                  {f.nome} ({f.status})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        {dest.flowId && (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">{dest.flowId}</span>
                        )}
                      </div>

                      {/* Peso */}
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
                  </div>
                )
              })}
            </div>

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
