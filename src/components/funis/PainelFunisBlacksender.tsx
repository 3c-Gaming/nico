'use client'

// Painel enxuto pra funis cujo receptivo roda na Black Sender (não SendPulse) — deliberadamente
// separado da tabela gigante de src/app/funis/page.tsx (que é 100% acoplada ao pipeline de
// bots/fluxos/tags da SendPulse) em vez de tentar encaixar aqui dentro. Reaproveita o que já é
// agnóstico de origem em src/lib/funis.ts (UTM, gasto por campanha Meta, ROI) — só "leads" tem
// um caminho próprio (ver FlowTagConfig.origem e contarBlacksenderLeadsPorFlowNoDia).

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'
import { Plus, Pin, Pen, Trash2, Save, MessageCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { UtmComboBox } from '@/components/ui/UtmComboBox'
import { getState, updateFlowTagConfig, deleteFlowTagConfig, togglePinFunil } from '@/lib/store'
import { buscarResultadosDoDia, calcularSnapshotDoFunil, contarFunisPorCampanha, contarFunisPorUtm, gastoDoFunil } from '@/lib/funis'
import { hojeBrasilISO } from '@/lib/datas'
import type { FlowTagConfig, BlacksenderFlow } from '@/types'
import type { CampanhaMeta } from '@/app/api/meta-ads/campanhas/route'

function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface SnapshotHoje {
  leads: number
  gasto: number
  custoEntrada: number | null
}

function useConfigsBlacksender(): FlowTagConfig[] {
  const versao = useSyncExternalStore(
    (cb) => { window.addEventListener('nico:state-changed', cb); return () => window.removeEventListener('nico:state-changed', cb) },
    () => Object.keys(getState().flowTagConfigs).length + getState().pinnedFunis.length,
    () => 0,
  )
  return useMemo(
    () => Object.values(getState().flowTagConfigs).filter((c): c is FlowTagConfig => c.origem === 'blacksender'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versao],
  )
}

function EditorFunilBlacksender({
  config,
  fluxosDisponiveis,
  configsExistentes,
  campanhas,
  onSave,
  onClose,
}: {
  config: FlowTagConfig | null
  fluxosDisponiveis: BlacksenderFlow[]
  configsExistentes: FlowTagConfig[]
  campanhas: CampanhaMeta[] | null
  onSave: () => void
  onClose: () => void
}) {
  const flowIdsJaConfigurados = new Set(configsExistentes.filter((c) => c.flowId !== config?.flowId).map((c) => c.flowId))
  const [flowId, setFlowId] = useState(config?.flowId ?? '')
  const [funil, setFunil] = useState(config?.funil ?? '')
  const [utm, setUtm] = useState(config?.utm ?? '')
  const [campanhasMeta, setCampanhasMeta] = useState<string[]>(config?.campanhasMeta ?? [])
  const [saving, setSaving] = useState(false)

  const fluxosSelecionaveis = fluxosDisponiveis.filter((f) => !flowIdsJaConfigurados.has(f.id))

  function toggleCampanha(nome: string) {
    setCampanhasMeta((prev) => (prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]))
  }

  function handleSelecionarFluxo(id: string) {
    setFlowId(id)
    if (!funil) {
      const nome = fluxosDisponiveis.find((f) => f.id === id)?.nome
      if (nome) setFunil(nome)
    }
  }

  async function handleSave() {
    if (!flowId) return
    setSaving(true)
    updateFlowTagConfig({
      flowId,
      botId: '',
      origem: 'blacksender',
      funil: funil || null,
      utm: utm || null,
      tags: [],
      campanhasMeta,
    })
    await new Promise((r) => setTimeout(r, 150))
    setSaving(false)
    onSave()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-20 shrink-0">Fluxo:</span>
        <select
          value={flowId}
          onChange={(e) => handleSelecionarFluxo(e.target.value)}
          disabled={!!config}
          className="flex-1 h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] disabled:opacity-60 transition-colors"
        >
          <option value="">selecione um fluxo da Black Sender...</option>
          {fluxosSelecionaveis.map((f) => (
            <option key={f.id} value={f.id}>{f.nome ?? f.id}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-20 shrink-0">Nome:</span>
        <input
          type="text"
          value={funil}
          onChange={(e) => setFunil(e.target.value)}
          placeholder="ex: F01.11"
          className="flex-1 h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-20 shrink-0">UTM/PID:</span>
        <UtmComboBox value={utm} onChange={setUtm} placeholder="selecione ou digite e Enter para cadastrar" />
      </div>
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-20 shrink-0 pt-1">Campanhas:</span>
        <div className="flex-1 flex flex-wrap gap-1.5">
          {!campanhas ? (
            <span className="text-xs text-[var(--text-muted)]/50 italic">Carregando campanhas do Meta...</span>
          ) : campanhas.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)]/50 italic">Nenhuma campanha do Meta hoje</span>
          ) : (
            campanhas.map((c) => {
              const selected = campanhasMeta.includes(c.nome)
              return (
                <button
                  key={c.nome}
                  type="button"
                  onClick={() => toggleCampanha(c.nome)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: selected ? 'var(--d1)' : 'var(--bg-elevated)',
                    border: `1px solid ${selected ? 'var(--d1)' : 'var(--border)'}`,
                    color: selected ? 'var(--bg-base)' : 'var(--text-muted)',
                  }}
                  title={formatMoeda(c.gasto)}
                >
                  {c.nome}
                </button>
              )
            })
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!flowId || saving}
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

export function PainelFunisBlacksender({ somentePinados = false }: { somentePinados?: boolean } = {}) {
  const todosConfigs = useConfigsBlacksender()
  // Precisa de useMemo: sem isso, um novo array a cada render (quando somentePinados filtra)
  // muda a identidade de `configs` toda vez, e como ele entra na dependência do efeito de
  // snapshot abaixo, disparava um loop infinito de fetch (setSnapshots -> re-render -> novo
  // array -> efeito de novo -> ...).
  const configs = useMemo(
    () => (somentePinados ? todosConfigs.filter((c) => c.funil && getState().pinnedFunis.includes(c.funil)) : todosConfigs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todosConfigs, somentePinados],
  )
  const [fluxosDisponiveis, setFluxosDisponiveis] = useState<BlacksenderFlow[]>([])
  const [campanhas, setCampanhas] = useState<CampanhaMeta[] | null>(null)
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotHoje>>({})
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<FlowTagConfig | null>(null)
  const [saveVersion, setSaveVersion] = useState(0)

  const hoje = hojeBrasilISO()
  const pinnedFunis = getState().pinnedFunis

  useEffect(() => {
    fetch('/api/blacksender/fluxos')
      .then((r) => (r.ok ? r.json() : { fluxos: [] }))
      .then((d) => setFluxosDisponiveis(d.fluxos ?? []))
      .catch(() => setFluxosDisponiveis([]))
  }, [])

  useEffect(() => {
    fetch(`/api/meta-ads/campanhas?from=${hoje}&to=${hoje}`)
      .then((r) => (r.ok ? r.json() : { campanhas: [] }))
      .then((d) => setCampanhas(d.campanhas ?? []))
      .catch(() => setCampanhas([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje])

  useEffect(() => {
    if (configs.length === 0) { setSnapshots({}); setCarregando(false); return }
    let cancelado = false
    setCarregando(true)
    const flowIds = configs.map((c) => c.flowId)
    const todasConfigs = Object.values(getState().flowTagConfigs)
    const funisPorUtm = contarFunisPorUtm(todasConfigs)
    const funisPorCampanha = contarFunisPorCampanha(todasConfigs)
    buscarResultadosDoDia(hoje, [], flowIds).then((dia) => {
      if (cancelado) return
      const next: Record<string, SnapshotHoje> = {}
      for (const cfg of configs) {
        const gasto = campanhas ? gastoDoFunil(cfg.campanhasMeta, campanhas, funisPorCampanha) : 0
        const snap = calcularSnapshotDoFunil(cfg, dia, [], gasto, funisPorUtm)
        next[cfg.flowId] = { leads: snap.leads, gasto, custoEntrada: snap.custoEntrada ?? null }
      }
      setSnapshots(next)
      setCarregando(false)
    })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, hoje, campanhas, saveVersion])

  function handleSalvo() {
    setModalAberto(false)
    setEditando(null)
    setSaveVersion((v) => v + 1)
  }

  function handleRemover(cfg: FlowTagConfig) {
    if (!confirm(`Desvincular o funil "${cfg.funil || cfg.flowId}" da Black Sender? Isso não apaga nada lá, só para de contar aqui.`)) return
    deleteFlowTagConfig(cfg.flowId)
    setSaveVersion((v) => v + 1)
  }

  if (somentePinados && configs.length === 0) return null
  if (!somentePinados && configs.length === 0 && fluxosDisponiveis.length === 0) return null

  return (
    <div className="space-y-3 p-4 glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: 'var(--d1)' }} />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Funis — Black Sender{somentePinados ? ' (fixados)' : ''}</h3>
        </div>
        {!somentePinados && (
          <button
            onClick={() => { setEditando(null); setModalAberto(true) }}
            className="flex items-center gap-1.5 px-2.5 h-7 rounded text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--d1)' }}
          >
            <Plus size={12} />
            Vincular fluxo
          </button>
        )}
      </div>

      {configs.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]/60 italic">Nenhum fluxo Black Sender vinculado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {configs.map((cfg) => {
            const snap = snapshots[cfg.flowId]
            const pinado = pinnedFunis.includes(cfg.funil ?? '')
            const nomeFluxo = fluxosDisponiveis.find((f) => f.id === cfg.flowId)?.nome ?? cfg.flowId
            return (
              <div key={cfg.flowId} className="p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border)] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold font-mono text-[var(--text-primary)] truncate">{cfg.funil || nomeFluxo}</p>
                    <p className="text-[10px] text-[var(--text-muted)]/60 truncate">{nomeFluxo}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => cfg.funil && togglePinFunil(cfg.funil)}
                      disabled={!cfg.funil}
                      title={pinado ? 'Desafixar da home' : 'Fixar na home'}
                      className="p-1 rounded transition-colors disabled:opacity-30"
                      style={{ color: pinado ? 'var(--d1)' : 'var(--text-muted)' }}
                    >
                      <Pin size={12} fill={pinado ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => { setEditando(cfg); setModalAberto(true) }}
                      title="Editar"
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Pen size={12} />
                    </button>
                    <button
                      onClick={() => handleRemover(cfg)}
                      title="Desvincular"
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{carregando ? '—' : (snap?.leads ?? 0)}</p>
                    <p className="text-[9px] text-[var(--text-muted)]/60 uppercase">Leads hoje</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{carregando ? '—' : formatMoeda(snap?.gasto ?? 0)}</p>
                    <p className="text-[9px] text-[var(--text-muted)]/60 uppercase">Gasto hoje</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{carregando || !snap?.custoEntrada ? '—' : formatMoeda(snap.custoEntrada)}</p>
                    <p className="text-[9px] text-[var(--text-muted)]/60 uppercase">Custo/lead</p>
                  </div>
                </div>
                {cfg.utm && <p className="text-[10px] font-mono text-[var(--text-muted)]/50">UTM: {cfg.utm}</p>}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalAberto} onClose={() => { setModalAberto(false); setEditando(null) }} title={editando ? 'Editar funil Black Sender' : 'Vincular fluxo da Black Sender'}>
        <EditorFunilBlacksender
          config={editando}
          fluxosDisponiveis={fluxosDisponiveis}
          configsExistentes={configs}
          campanhas={campanhas}
          onSave={handleSalvo}
          onClose={() => { setModalAberto(false); setEditando(null) }}
        />
      </Modal>
    </div>
  )
}
