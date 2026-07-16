'use client'

import { useState, useEffect, useMemo, Fragment, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw, Play, Pause, FileText, AlertTriangle, Layers, Pen, Save, X, Plus, Search, Pin, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { getState, setState, updateFlowTagConfig, togglePinFunil, updateCacheMetricas } from '@/lib/store'
import type { NumeroSendpulse, FluxoSendpulse, CasaAposta } from '@/types'

function getLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface FlowRow {
  botId: string
  botNome: string
  botNumero: string
  flow: FluxoSendpulse
  funil?: string | null
  utm?: string | null
  lpUrl?: string | null
  tags: string[]
  casas: string[]
  leadsHoje: number
  total: number
  ultimoLeadAt: string | null
  carregandoContagens: boolean
}

function FlowStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
      status === 'ativo' ? 'text-green-500' :
      status === 'inativo' ? 'text-red-400' : 'text-amber-400'
    }`}>
      {status === 'ativo' ? <Play size={10} /> :
       status === 'rascunho' ? <FileText size={10} /> : <Pause size={10} />}
      {status === 'ativo' ? 'Ativo' :
       status === 'inativo' ? 'Inativo' : 'Rascunho'}
    </span>
  )
}

function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)]">
      {label}
    </span>
  )
}

function FunilChip({ label, cor }: { label: string; cor?: string }) {
  const c = cor ?? 'var(--d1)'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono"
      style={{
        backgroundColor: `${c}20`,
        border: `1px solid ${c}30`,
        color: c,
      }}
    >
      {label}
    </span>
  )
}

function formatarTempoRelativo(iso: string | null): { texto: string; cor: string } {
  if (!iso) return { texto: '—', cor: 'text-[var(--text-muted)]/40' }
  const agora = Date.now()
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return { texto: iso, cor: 'text-[var(--text-muted)]' }
  const diffMs = agora - ts
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffMin < 1) return { texto: 'agora', cor: 'text-green-400' }
  if (diffMin < 5) return { texto: 'agora', cor: 'text-green-400' }
  if (diffMin < 60) return { texto: `há ${diffMin}min`, cor: 'text-amber-400' }
  if (diffH < 24) return { texto: `há ${diffH}h`, cor: 'text-amber-400/70' }
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return { texto: `${dd}/${mm} ${hh}:${mm}`, cor: 'text-[var(--text-muted)]/60' }
}

function FlowTagEditor({ flow, botId, onSave }: { flow: FluxoSendpulse; botId: string; onSave: () => void }) {
  const configs = getState().flowTagConfigs
  const existing = configs[flow.id]
  const [funil, setFunil] = useState(existing?.funil ?? '')
  const [utm, setUtm] = useState(existing?.utm ?? '')
  const [lpUrl, setLpUrl] = useState(existing?.lpUrl ?? '')
  const [tipo, setTipo] = useState<'traffic' | 'disparo'>(existing?.tipo ?? 'disparo')
  const [tags, setTags] = useState<string[]>(existing?.tags ?? [])
  const [casas, setCasas] = useState<string[]>(existing?.casas ?? [])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const casasAposta = Object.values(getState().casasAposta)

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

  function toggleCasa(casaId: string) {
    setCasas((prev) => prev.includes(casaId) ? prev.filter((id) => id !== casaId) : [...prev, casaId])
  }

  async function handleSave() {
    setSaving(true)
    updateFlowTagConfig({ flowId: flow.id, botId, funil: funil || null, utm: utm || null, lpUrl: lpUrl || null, tags, casas, tipo })
    await new Promise((r) => setTimeout(r, 200))
    setSaving(false)
    onSave()
  }

  const prevFunil = existing?.funil ?? ''
  const prevUtm = existing?.utm ?? ''
  const prevLpUrl = existing?.lpUrl ?? ''
  const prevCasas = (existing?.casas ?? []).join(',')
  const hasChanges = prevFunil !== funil || prevUtm !== utm || prevLpUrl !== lpUrl || (existing?.tipo ?? 'disparo') !== tipo || (existing?.tags ?? []).join(',') !== tags.join(',') || prevCasas !== casas.join(',')

  return (
    <div className="space-y-3 p-4 glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16">Funil:</span>
        <input
          type="text"
          value={funil}
          onChange={(e) => setFunil(e.target.value)}
          placeholder="ex: F26.02"
          className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16">UTM/PID:</span>
        <input
          type="text"
          value={utm}
          onChange={(e) => setUtm(e.target.value)}
          placeholder="ex: pilhado-disp-traf-odm ou 13382"
          className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16">LP URL:</span>
        <input
          type="url"
          value={lpUrl}
          onChange={(e) => setLpUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16">Tipo:</span>
        <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--border)] rounded p-0.5">
          <button
            onClick={() => setTipo('disparo')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${tipo === 'disparo' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Disparo
          </button>
          <button
            onClick={() => setTipo('traffic')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${tipo === 'traffic' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Tráfego
          </button>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16 pt-1">Tags:</span>
        <div className="flex-1 space-y-1.5">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)]">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="+ adicionar tag…"
              className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
            />
            <button
              onClick={addTag}
              disabled={!input.trim()}
              className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16 pt-1">Casas:</span>
        <div className="flex-1 flex flex-wrap gap-1.5">
          {casasAposta.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)]/40 italic">Nenhuma casa cadastrada</span>
          ) : (
            casasAposta.map((casa) => {
              const selected = casas.includes(casa.id)
              return (
                <button
                  key={casa.id}
                  onClick={() => toggleCasa(casa.id)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: selected ? `${casa.cor}20` : 'var(--bg-elevated)',
                    border: `1px solid ${selected ? `${casa.cor}40` : 'var(--border)'}`,
                    color: selected ? casa.cor : 'var(--text-muted)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: casa.cor }} />
                  {casa.nome}
                </button>
              )
            })
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'var(--d1)' }}
        >
          <Save size={12} />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

function FunisPageInner() {
  const searchParams = useSearchParams()
  const [numeros, setNumeros] = useState<NumeroSendpulse[]>([])
  const [fluxosMap, setFluxosMap] = useState<Record<string, FluxoSendpulse[]>>({})
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const [contagensTotal, setContagensTotal] = useState<Record<string, number>>({})
  const [ultimoLeadMap, setUltimoLeadMap] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroBot, setFiltroBot] = useState<string>('')
  const [filtroBusca, setFiltroBusca] = useState(searchParams.get('busca') ?? '')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [recarregandoTag, setRecarregandoTag] = useState<Record<string, boolean>>({})
  const [saveVersion, setSaveVersion] = useState(0)
  const [trackingMap, setTrackingMap] = useState<Record<string, { registros: number; ftds: number }>>({})
  const [trackingData, setTrackingData] = useState(getLocalDate())
  const [trackingLoaded, setTrackingLoaded] = useState(false)

  async function carregarDados() {
    setLoading(!refreshing)
    setRefreshing(true)
    setError(null)

    try {
      const numRes = await fetch('/api/sendpulse/numeros')
      if (!numRes.ok) throw new Error('Erro ao carregar números')
      const numData = await numRes.json()
      const nums: NumeroSendpulse[] = numData.numeros
      setNumeros(nums)

      const fluxos: Record<string, FluxoSendpulse[]> = {}
      await Promise.allSettled(
        nums.map(async (num) => {
          const fRes = await fetch(`/api/sendpulse/fluxos?bot_id=${encodeURIComponent(num.id)}`)
          if (!fRes.ok) return
          const fData = await fRes.json()
          fluxos[num.id] = fData.fluxos
        })
      )
      setFluxosMap(fluxos)

      const configs = getState().flowTagConfigs
      const allTags = [...new Set(
        Object.values(fluxos).flat().flatMap((f) => configs[f.id]?.tags ?? [])
      )]

      if (allTags.length > 0) {
        const res = await fetch('/api/leadhub/contagem-por-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: allTags }),
        })
        if (res.ok) {
          const data = await res.json()
          setContagens(data.leads ?? {})
          setContagensTotal(data.totais ?? {})
          setUltimoLeadMap(data.ultimoLead ?? {})
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function recarregarTag(row: FlowRow) {
    const key = `${row.botId}-${row.flow.id}`
    if (!row.tags.length || recarregandoTag[key]) return
    setRecarregandoTag((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await fetch('/api/leadhub/contagem-por-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: row.tags, refresh: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setContagens((prev) => ({ ...prev, ...data.leads }))
        setContagensTotal((prev) => ({ ...prev, ...data.totais }))
        setUltimoLeadMap((prev) => ({ ...prev, ...data.ultimoLead }))
      }
    } catch {} finally {
      setRecarregandoTag((prev) => ({ ...prev, [key]: false }))
    }
  }

  useEffect(() => { carregarDados() }, [saveVersion])

  // Busca tracking 3CGG para todos os flows que têm utm
  useEffect(() => {
    const configs = getState().flowTagConfigs
    const withUtm = Object.values(configs).filter((c) => c.utm)
    if (!withUtm.length) return

    async function fetchTracking() {
      const [superbetRes, betmgmRes] = await Promise.all([
        fetch(`/api/tracking/export?casa=superbet&date=${trackingData}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/tracking/export?casa=betmgm&date=${trackingData}`).then((r) => r.json()).catch(() => ({})),
      ])

      const superbetEvents: any[] = (superbetRes as any)?.data ?? []
      const betmgmEvents: any[] = (betmgmRes as any)?.data ?? []

      const novo: Record<string, { registros: number; ftds: number }> = {}
      for (const cfg of withUtm) {
        const utm = cfg.utm!
        let registros = 0
        let ftds = 0
        for (const item of superbetEvents) {
          if (String(item.acid).includes(utm)) {
            registros += item.registrations ?? 0
            ftds += item.ftds ?? 0
          }
        }
        for (const item of betmgmEvents) {
          if (String(item.marketing_source_id) === utm) {
            registros += item.registrations ?? 0
            ftds += item.ftds ?? 0
          }
        }
        novo[cfg.flowId] = { registros, ftds }
      }
      setTrackingMap(novo)

      // Salva cache por funil no banco
      const configsSnapshot = getState().flowTagConfigs
      const perFunil: Record<string, { registros: number; ftds: number }> = {}
      for (const [flowId, val] of Object.entries(novo)) {
        const cfg = configsSnapshot[flowId]
        if (cfg?.funil) {
          if (!perFunil[cfg.funil]) perFunil[cfg.funil] = { registros: 0, ftds: 0 }
          perFunil[cfg.funil].registros += val.registros
          perFunil[cfg.funil].ftds += val.ftds
        }
      }
      const cacheArr = Object.entries(perFunil).map(([funil, val]) => ({
        funil,
        leadsHoje: 0,
        totalLeads: 0,
        registros: val.registros,
        ftds: val.ftds,
        atualizadoEm: new Date().toISOString(),
      }))
      if (cacheArr.length > 0) updateCacheMetricas(cacheArr)

      setTrackingLoaded(true)
    }

    fetchTracking()
  }, [trackingData, saveVersion])

  const flowRows = useMemo(() => {
    const termo = filtroBusca.toLowerCase()
    const rows: FlowRow[] = []
    for (const num of numeros) {
      if (filtroBot && num.id !== filtroBot) continue
      const flows = fluxosMap[num.id]
      if (!flows) continue
      for (const flow of flows) {
        const configs = getState().flowTagConfigs
        const tags = configs[flow.id]?.tags ?? []
        const funil = configs[flow.id]?.funil
        const leads = tags.reduce((acc, t) => acc + (contagens[t] ?? 0), 0)
        const total = tags.reduce((acc, t) => acc + (contagensTotal[t] ?? 0), 0)
        const ultimoLeadAt = tags.reduce<string | null>((best, t) => {
          const ts = ultimoLeadMap[t] ?? null
          if (!ts) return best
          if (!best || ts > best) return ts
          return best
        }, null)
        if (termo && !flow.nome.toLowerCase().includes(termo) && !(funil ?? '').toLowerCase().includes(termo)) continue
        rows.push({
          botId: num.id,
          botNome: num.nome,
          botNumero: num.numero,
          flow,
          funil,
          utm: configs[flow.id]?.utm,
          lpUrl: configs[flow.id]?.lpUrl,
          tags,
          casas: configs[flow.id]?.casas ?? [],
          leadsHoje: leads,
          total,
          ultimoLeadAt,
          carregandoContagens: tags.length > 0 && Object.keys(contagens).length === 0 && Object.keys(contagensTotal).length === 0,
        })
      }
    }
    rows.sort((a, b) => {
      if (a.leadsHoje !== b.leadsHoje) return b.leadsHoje - a.leadsHoje
      if ((a.funil ?? '') !== (b.funil ?? '')) return (b.funil ?? '').localeCompare(a.funil ?? '')
      return a.botNome.localeCompare(b.botNome)
    })
    return rows
  }, [numeros, fluxosMap, contagens, contagensTotal, ultimoLeadMap, filtroBot, filtroBusca])

  const totalComFunil = flowRows.filter((r) => r.funil).length

  return (
    <>
      <PageHeader
        titulo="Funis"
        descricao="Monitoramento de fluxos por tag"
        acoes={
          <button
            onClick={() => setSaveVersion((v) => v + 1)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Carregando...' : 'Recarregar'}
          </button>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-[var(--text-muted)]">Bot:</label>
          <select
            value={filtroBot}
            onChange={(e) => setFiltroBot(e.target.value)}
            className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
          >
            <option value="">Todos</option>
            {numeros.map((num) => (
              <option key={num.id} value={num.id}>{num.nome}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 flex-1 max-w-xs">
            <Search size={14} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Buscar por fluxo ou funil…"
              className="flex-1 h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          </div>
          <input
            type="date"
            value={trackingData}
            onChange={(e) => setTrackingData(e.target.value)}
            className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />

          <span className="text-xs text-[var(--text-muted)] ml-auto whitespace-nowrap">
            {flowRows.length} fluxo(s)
            {totalComFunil > 0 && (
              <span className="ml-1">
                · {totalComFunil} com funil
              </span>
            )}
            {flowRows.filter((r) => r.tags.length > 0).length > 0 && (
              <span className="ml-1">
                · {flowRows.filter((r) => r.tags.length > 0).length} com tag(s)
              </span>
            )}
          </span>
        </div>

        {loading && numeros.length === 0 && (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        )}

        {!loading && numeros.length === 0 && !error && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum bot encontrado.
          </div>
        )}

        {flowRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Funil</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Bot</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Número</th>
                   <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Fluxo</th>
                   <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Flow ID</th>
                   <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">LP</th>
                   <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Tags</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Último lead</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Leads hoje</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Total</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Reg</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">FTDs</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]"></th>
                </tr>
              </thead>
              <tbody>
                {flowRows.map((row) => {
                  const configKey = `${row.botId}-${row.flow.id}`
                  const isEditing = editingKey === configKey
                  return (
                    <Fragment key={configKey}>
                      <tr className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors">
                        <td className="py-3 px-3">
                          {row.funil ? (
                            <div className="flex items-center gap-1.5">
                              {row.casas.length > 0 && (
                                <div className="flex -space-x-0.5">
                                  {row.casas.slice(0, 3).map((casaId) => {
                                    const casa = (getState().casasAposta as Record<string, CasaAposta>)[casaId]
                                    return casa ? (
                                      <span
                                        key={casaId}
                                        className="w-2 h-2 rounded-full ring-1 ring-[var(--bg-base)]"
                                        style={{ backgroundColor: casa.cor }}
                                        title={casa.nome}
                                      />
                                    ) : null
                                  })}
                                </div>
                              )}
                              <FunilChip
                                label={row.funil}
                                cor={(() => {
                                  const primeiraId = row.casas[0]
                                  if (!primeiraId) return undefined
                                  const c = (getState().casasAposta as Record<string, CasaAposta>)[primeiraId]
                                  return c?.cor
                                })()}
                              />
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)]/40 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[var(--text-muted)] text-xs font-mono">{row.botNome}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[var(--text-muted)] text-xs font-mono">{row.botNumero}</span>
                        </td>
                         <td className="py-3 px-3">
                           <div className="text-[var(--text-primary)] font-medium text-sm">{row.flow.nome}</div>
                           {row.flow.triggers.length > 0 && (
                             <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                               {row.flow.triggers.map((t) => t.nome).join(', ')}
                             </div>
                           )}
                         </td>
                         <td className="py-3 px-3">
                           <span className="text-[10px] text-[var(--text-muted)]/60 font-mono truncate block max-w-[140px]" title={row.flow.id}>
                             {row.flow.id}
                           </span>
                         </td>
                         <td className="py-3 px-3">
                           {row.lpUrl ? (
                             <a
                               href={row.lpUrl}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="inline-flex items-center gap-1 text-[11px] text-[var(--d1)] hover:underline font-mono truncate max-w-[160px]"
                               title={row.lpUrl}
                             >
                               <ExternalLink size={10} className="shrink-0" />
                               {row.lpUrl.replace(/^https?:\/\//, '').slice(0, 30)}
                             </a>
                           ) : (
                             <span className="text-[10px] text-[var(--text-muted)]/40">—</span>
                           )}
                         </td>
                        <td className="py-3 px-3">
                          <FlowStatusBadge status={row.flow.status} />
                        </td>
                        <td className="py-3 px-3">
                          {row.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.tags.map((tag) => (
                                <TagChip key={tag} label={tag} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)]/40 italic">sem tags</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {row.carregandoContagens || !row.tags.length ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : (
                            (() => {
                              const f = formatarTempoRelativo(row.ultimoLeadAt)
                              return <span className={`text-xs font-mono ${f.cor}`}>{f.texto}</span>
                            })()
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {row.carregandoContagens ? (
                            <Spinner size={12} />
                          ) : !row.tags.length ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : (
                            <span className={`font-semibold ${row.leadsHoje > 0 ? 'text-[var(--d3)]' : 'text-[var(--text-muted)]'}`}>
                              {row.leadsHoje}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {row.carregandoContagens ? (
                            <Spinner size={12} />
                          ) : !row.tags.length ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : (
                            <span className={`font-semibold ${row.total > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                              {row.total}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!row.utm ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : !trackingLoaded && row.funil && getState().cacheMetricas[row.funil] ? (
                            <span className="font-semibold font-mono text-[var(--text-muted)]/60">
                              {getState().cacheMetricas[row.funil].registros}
                            </span>
                          ) : (
                            <span className={`font-semibold font-mono ${(trackingMap[row.flow.id]?.registros ?? 0) > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                              {trackingMap[row.flow.id]?.registros ?? 0}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!row.utm ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : !trackingLoaded && row.funil && getState().cacheMetricas[row.funil] ? (
                            <span className="font-semibold font-mono text-[var(--text-muted)]/60">
                              {getState().cacheMetricas[row.funil].ftds}
                            </span>
                          ) : (
                            <span className={`font-semibold font-mono ${(trackingMap[row.flow.id]?.ftds ?? 0) > 0 ? 'text-[var(--d1)]' : 'text-[var(--text-muted)]'}`}>
                              {trackingMap[row.flow.id]?.ftds ?? 0}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            {row.funil && (
                              <button
                                onClick={() => togglePinFunil(row.funil!)}
                                className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                                title={getState().pinnedFunis.includes(row.funil) ? 'Desafixar da Home' : 'Fixar na Home'}
                              >
                                <Pin size={13} className={getState().pinnedFunis.includes(row.funil) ? 'text-amber-400' : 'text-[var(--text-muted)]/40'} />
                              </button>
                            )}
                            {row.tags.length > 0 && (
                              <button
                                onClick={() => recarregarTag(row)}
                                disabled={recarregandoTag[configKey]}
                                className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40"
                                title="Recarregar contagem de leads"
                              >
                                <RefreshCw size={12} className={recarregandoTag[configKey] ? 'animate-spin' : ''} />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingKey(isEditing ? null : configKey)}
                              className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                              title="Editar funil e tags"
                            >
                              <Pen size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr>
                          <td colSpan={14} className="p-0 border-b border-[var(--glass-border)]">
                            <div className="px-3 py-3">
                              <FlowTagEditor
                                flow={row.flow}
                                botId={row.botId}
                                onSave={() => { setEditingKey(null); setSaveVersion((v) => v + 1) }}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && flowRows.length === 0 && numeros.length > 0 && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum fluxo encontrado.
          </div>
        )}
      </div>
    </>
  )
}

export default function FunisPage() {
  return (
    <Suspense>
      <FunisPageInner />
    </Suspense>
  )
}
