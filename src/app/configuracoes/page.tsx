'use client'

import { useState, useEffect, Fragment } from 'react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { RefreshCw, ChevronDown, ChevronRight, Save, Play, Pause, FileText, Plus, X, Check, AlertTriangle, UserPlus, UserX } from 'lucide-react'
import { getState, updateFlowTagConfig, addUsuarioResponsavel, deletarUsuarioResponsavel } from '@/lib/store'
import type { NumeroSendpulse, FluxoSendpulse, FlowTagConfig, UsuarioResponsavel } from '@/types'

function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)]">
      {label}
      <button onClick={onRemove} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
        <X size={12} />
      </button>
    </span>
  )
}

function FlowTagEditor({ flow, botId, onSave }: { flow: FluxoSendpulse; botId: string; onSave: () => void }) {
  const configs = getState().flowTagConfigs
  const existing = configs[flow.id]
  const [tags, setTags] = useState<string[]>(existing?.tags ?? [])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  function addTag() {
    const val = input.trim()
    if (val && !tags.includes(val)) {
      setTags([...tags, val])
      setInput('')
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addTag() }
  }

  async function handleSave() {
    setSaving(true)
    updateFlowTagConfig({ flowId: flow.id, botId, tags })
    await new Promise((r) => setTimeout(r, 200))
    setSaving(false)
    onSave()
  }

  const hasChanges = (existing?.tags ?? []).join(',') !== tags.join(',')

  return (
    <div className="space-y-2 pl-6 border-l-2 border-[var(--border)] ml-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs">
          {flow.status === 'ativo' ? <Play size={10} className="text-green-500" /> : flow.status === 'inativo' ? <Pause size={10} className="text-red-400" /> : <FileText size={10} className="text-amber-400" />}
          <span className={`font-medium ${flow.status === 'ativo' ? 'text-green-500' : flow.status === 'inativo' ? 'text-red-400' : 'text-amber-400'}`}>
            {flow.status === 'ativo' ? 'Ativo' : flow.status === 'inativo' ? 'Inativo' : 'Rascunho'}
          </span>
        </span>
        <span className="text-sm text-[var(--text-primary)] font-medium">{flow.nome}</span>
        <code className="text-[10px] text-[var(--text-muted)] font-mono">{flow.id.slice(0, 12)}…</code>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <TagChip key={tag} label={tag} onRemove={() => removeTag(tag)} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="+ adicionar tag…"
          className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
        <Button size="sm" variant="ghost" onClick={addTag} disabled={!input.trim()}>
          <Plus size={12} />
        </Button>
        <Button size="sm" onClick={handleSave} loading={saving} disabled={!hasChanges}>
          <Save size={12} />
          Salvar
        </Button>
      </div>

      {flow.triggers.length > 0 && (
        <div className="text-[10px] text-[var(--text-muted)]">
          Triggers: {flow.triggers.map((t) => t.nome).join(', ')}
        </div>
      )}
    </div>
  )
}

const TOKEN_KEY = 'nico_daxx_token'

function DaxxTokenSection() {
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [status, setStatus] = useState<'ok' | 'erro' | null>(null)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    const tk = localStorage.getItem(TOKEN_KEY)
    if (tk) { setInput(tk); setSaved(tk) }
  }, [])

  async function handleSave() {
    setSalvando(true)
    localStorage.setItem(TOKEN_KEY, input)
    setSaved(input)
    setStatus(null)
    await new Promise((r) => setTimeout(r, 200))
    setSalvando(false)
  }

  async function handleTest() {
    const tk = input
    if (!tk) return
    setTestando(true)
    setStatus(null)
    try {
      const res = await fetch('/api/daxx/disparos-agendados', {
        headers: { 'x-daxx-token': tk },
      })
      setStatus(res.ok ? 'ok' : 'erro')
    } catch {
      setStatus('erro')
    } finally {
      setTestando(false)
    }
  }

  const hasChanges = input !== saved

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type={showToken ? 'text' : 'password'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Cole o JWT do daxX aqui…"
          className="flex-1 h-8 px-3 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
        <button
          onClick={() => setShowToken(!showToken)}
          className="px-2 h-8 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] bg-[var(--bg-surface)]"
          title={showToken ? 'Esconder' : 'Mostrar'}
        >
          {showToken ? '🙈' : '👁'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} loading={salvando} disabled={!hasChanges || !input.trim()}>
          <Save size={12} />
          Salvar
        </Button>
        <Button size="sm" variant="secondary" onClick={handleTest} loading={testando} disabled={!input.trim()}>
          Testar
        </Button>
        {status === 'ok' && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <Check size={12} />
            Token válido
          </span>
        )}
        {status === 'erro' && (
          <span className="flex items-center gap-1 text-xs text-[var(--error)]">
            <AlertTriangle size={12} />
            Token inválido ou expirado
          </span>
        )}
      </div>
    </div>
  )
}

function ResponsaveisSection() {
  const [usuarios, setUsuarios] = useState<UsuarioResponsavel[]>([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [cor, setCor] = useState('#6366f1')
  const [discordId, setDiscordId] = useState('')
  const [adding, setAdding] = useState(false)

  const cores = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']

  async function carregar() {
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios-responsaveis')
      if (res.ok) {
        const data = await res.json()
        setUsuarios(data.usuarios)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function handleAdd() {
    if (!nome.trim()) return
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11)
    const usuario: UsuarioResponsavel = {
      id,
      nome: nome.trim(),
      email: email.trim() || undefined,
      cargo: cargo.trim() || undefined,
      avatar: cor,
      discordId: discordId.trim() || undefined,
      criadoEm: new Date().toISOString(),
    }
    addUsuarioResponsavel(usuario)
    setUsuarios([...usuarios, usuario])
    setNome('')
    setEmail('')
    setCargo('')
    setDiscordId('')
    setAdding(false)
  }

  async function handleDelete(id: string) {
    deletarUsuarioResponsavel(id)
    setUsuarios(usuarios.filter((u) => u.id !== id))
  }

  if (loading) return <Spinner size={16} />

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {usuarios.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold text-white flex-shrink-0"
              style={{ backgroundColor: u.avatar ?? '#6366f1' }}
            >
              {u.nome.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-[var(--text-primary)] font-medium">{u.nome}</span>
              {u.cargo && <span className="text-xs text-[var(--text-muted)] ml-2">{u.cargo}</span>}
              {u.email && <p className="text-[10px] text-[var(--text-muted)]">{u.email}</p>}
              {u.discordId && <p className="text-[10px] text-[var(--text-muted)]">Discord: {u.discordId}</p>}
            </div>
            <button
              onClick={() => handleDelete(u.id)}
              className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
              title="Remover"
            >
              <UserX size={14} />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="space-y-2 p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do responsavel"
            className="w-full h-8 px-3 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (opcional)"
            className="w-full h-8 px-3 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />
          <input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Cargo (opcional)"
            className="w-full h-8 px-3 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />
          <input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="ID Discord (opcional)"
            className="w-full h-8 px-3 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)]">Cor:</span>
            {cores.map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${cor === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} disabled={!nome.trim()}>
              <Save size={12} /> Adicionar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <UserPlus size={14} /> Adicionar Responsavel
        </Button>
      )}
    </div>
  )
}

function BotTestConfigSection() {
  const [intervaloMinutos, setIntervaloMinutos] = useState(15)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    fetch('/api/bot-test/config')
      .then(r => r.json())
      .then(data => {
        setIntervaloMinutos(data.config.pollIntervalMs / 60000)
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  async function handleSave() {
    setSalvando(true)
    setSalvo(false)
    try {
      const res = await fetch('/api/bot-test/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollIntervalMs: intervaloMinutos * 60000,
        }),
      })
      if (res.ok) setSalvo(true)
    } catch {}
    setSalvando(false)
  }

  if (carregando) return <Spinner size={16} />

  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <label className="block text-xs text-[var(--text-muted)] mb-1">Intervalo entre ciclos (minutos)</label>
        <input
          type="number"
          min={1}
          max={1440}
          value={intervaloMinutos}
          onChange={e => setIntervaloMinutos(Number(e.target.value))}
          className="w-full h-8 px-3 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} loading={salvando}>
          <Save size={12} />
          Salvar
        </Button>
        {salvo && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <Check size={12} />
            Configuração salva
          </span>
        )}
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const [numeros, setNumeros] = useState<NumeroSendpulse[]>([])
  const [fluxosPorBot, setFluxosPorBot] = useState<Record<string, FluxoSendpulse[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedBot, setExpandedBot] = useState<string | null>(null)
  const [saveVersion, setSaveVersion] = useState(0)

  async function carregarDados() {
    setLoading(true)
    setError(null)
    try {
      const numRes = await fetch('/api/sendpulse/numeros')
      if (!numRes.ok) throw new Error('Erro ao carregar números')
      const numData = await numRes.json()
      const nums: NumeroSendpulse[] = numData.numeros
      setNumeros(nums)

      const fluxosMap: Record<string, FluxoSendpulse[]> = {}
      await Promise.allSettled(
        nums.map(async (num) => {
          const fRes = await fetch(`/api/sendpulse/fluxos?bot_id=${encodeURIComponent(num.id)}`)
          if (!fRes.ok) return
          const fData = await fRes.json()
          fluxosMap[num.id] = fData.fluxos
        })
      )
      setFluxosPorBot(fluxosMap)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarDados() }, [])

  const [totalConfigs, setTotalConfigs] = useState<number | undefined>(undefined)
  useEffect(() => {
    setTotalConfigs(Object.keys(getState().flowTagConfigs).length)
  }, [])

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <h1 className="text-lg font-mono text-[var(--text-primary)]">Configurações</h1>

      <div className="flex items-center justify-between max-w-sm p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)]">
        <span className="text-sm text-[var(--text-primary)]">Tema</span>
        <ThemeToggle />
      </div>

      <div className="max-w-2xl p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Responsaveis para Demandas</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Cadastre os responsaveis que poderao ser atribuidos as demandas no Kanban.
        </p>
        <ResponsaveisSection />
      </div>

      <div className="max-w-2xl p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Token daxX</h2>

        <DaxxTokenSection />
      </div>

      <div className="max-w-2xl p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Teste de Bots</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Configurações do monitoramento automático de bots via SendPulse.
        </p>

        <BotTestConfigSection />
      </div>

      <div className="max-w-2xl p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tags dos Fluxos</h2>
            {totalConfigs !== undefined && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {totalConfigs > 0
                  ? `${totalConfigs} fluxo(s) com tag(s) configurada(s)`
                  : 'Nenhum fluxo configurado ainda'}
              </p>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={carregarDados} loading={loading}>
            <RefreshCw size={14} />
            Carregar
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-4" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {loading && numeros.length === 0 && (
          <div className="flex justify-center py-8">
            <Spinner size={24} />
          </div>
        )}

        {!loading && numeros.length === 0 && !error && (
          <p className="text-xs text-[var(--text-muted)] text-center py-8">
            Nenhum número encontrado. Clique em "Carregar" para buscar.
          </p>
        )}

        <div className="space-y-2">
          {numeros.map((num) => {
            const fluxos = fluxosPorBot[num.id]
            const isExpanded = expandedBot === num.id
            return (
              <div key={num.id} className="rounded-md border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => setExpandedBot(isExpanded ? null : num.id)}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-[var(--bg-elevated)]/50 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" /> : <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />}
                  <span className="text-sm font-medium text-[var(--text-primary)]">{num.nome}</span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">{num.numero}</span>
                  {fluxos && (
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">{fluxos.length} fluxo(s)</span>
                  )}
                </button>
                {isExpanded && fluxos && (
                  <div className="px-3 pb-3 space-y-3">
                    {fluxos.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] pl-6 py-2">Nenhum fluxo encontrado</p>
                    )}
                    {fluxos.map((flow) => (
                      <FlowTagEditor
                        key={flow.id}
                        flow={flow}
                        botId={num.id}
                        onSave={() => setSaveVersion((v) => v + 1)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
