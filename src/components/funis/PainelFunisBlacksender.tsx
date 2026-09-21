'use client'

// Painel enxuto pra funis cujo receptivo roda na Black Sender (não SendPulse) — deliberadamente
// separado da tabela gigante de src/app/funis/page.tsx (que é 100% acoplada ao pipeline de
// bots/fluxos/tags da SendPulse) em vez de tentar encaixar aqui dentro. Reaproveita o que já é
// agnóstico de origem em src/lib/funis.ts (UTM, gasto por campanha Meta, ROI) — só "leads" tem
// um caminho próprio (ver FlowTagConfig.origem e contarBlacksenderLeadsPorFlowNoDia). Edição e
// colunas espelham o mesmo padrão visual da tabela de funis SendPulse (accordion inline, casas,
// Conv./Custo por coluna) — ver src/app/funis/page.tsx.

import { useState, useEffect, useMemo, useSyncExternalStore, Fragment } from 'react'
import { Plus, Pin, Trash2, Save, Layers, Eye, Pen } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { UtmComboBox } from '@/components/ui/UtmComboBox'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { getState, updateFlowTagConfig, deleteFlowTagConfig, togglePinFunil } from '@/lib/store'
import { buscarResultadosDoDia, calcularSnapshotDoFunil, contarFunisPorCampanha, contarFunisPorUtm, gastoDoFunil } from '@/lib/funis'
import { hojeBrasilISO } from '@/lib/datas'
import { PainelAnaliseFunilBlacksender } from './PainelAnaliseFunilBlacksender'
import type { FlowTagConfig, BlacksenderFlow, CasaAposta } from '@/types'
import type { CampanhaMeta } from '@/app/api/meta-ads/campanhas/route'

function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "16/09 19:09" — pedido explicitamente nesse formato absoluto (não relativo tipo "há 2h") pra
 * bater exatamente com a coluna equivalente da tabela SendPulse... só que lá é relativo. Aqui o
 * pedido foi por data/hora fixa, então é isso que formata. */
function formatarUltimoLead(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes} ${hh}:${mm}`
}

/** buscarCampanhasMeta devolve uma linha por (campanha, dia) — e às vezes mais de uma linha pro
 * mesmo (campanha, dia) dependendo de como o relatório de origem quebra os dados. Sem agregar por
 * nome antes de listar, a mesma campanha aparece repetida no seletor (e usar `nome` como key do
 * React quebra, já que não é único). Mesmo princípio de agregarCampanhasPorNome em
 * PainelConversasFluxo.tsx (não compartilhado — duplicado de propósito, igual o resto do arquivo). */
function agregarCampanhasPorNome(campanhas: CampanhaMeta[]): { nome: string; gasto: number }[] {
  const mapa = new Map<string, number>()
  for (const c of campanhas) mapa.set(c.nome, (mapa.get(c.nome) ?? 0) + c.gasto)
  return [...mapa.entries()].map(([nome, gasto]) => ({ nome, gasto })).sort((a, b) => b.gasto - a.gasto)
}

interface SnapshotHoje {
  leads: number
  registros: number
  ftds: number
  gasto: number
  custoEntrada: number | null
  custoRegistro: number | null
  custoFtd: number | null
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
  casasList,
  onSave,
  onClose,
}: {
  config: FlowTagConfig | null
  fluxosDisponiveis: BlacksenderFlow[]
  configsExistentes: FlowTagConfig[]
  campanhas: CampanhaMeta[] | null
  casasList: CasaAposta[]
  onSave: () => void
  onClose: () => void
}) {
  const flowIdsJaConfigurados = new Set(configsExistentes.filter((c) => c.flowId !== config?.flowId).map((c) => c.flowId))
  const [flowId, setFlowId] = useState(config?.flowId ?? '')
  const [funil, setFunil] = useState(config?.funil ?? '')
  const [utm, setUtm] = useState(config?.utm ?? '')
  // Sem essa escolha, FlowTagConfig.tipo fica undefined e cai no default 'disparo' (ver
  // src/app/page.tsx) — todo funil Black Sender ia parar na seção "Disparo" da home, mesmo sendo
  // tráfego de verdade (fluxo disparado por keyword/clique em anúncio, não blast em massa).
  const [tipo, setTipo] = useState<'traffic' | 'disparo'>(config?.tipo ?? 'traffic')
  const [casas, setCasas] = useState<string[]>(config?.casas ?? [])
  const [campanhasMeta, setCampanhasMeta] = useState<string[]>(config?.campanhasMeta ?? [])
  const [saving, setSaving] = useState(false)
  const [buscaCampanha, setBuscaCampanha] = useState('')

  const fluxosSelecionaveis = fluxosDisponiveis.filter((f) => !flowIdsJaConfigurados.has(f.id))

  const agregadas = useMemo(() => (campanhas ? agregarCampanhasPorNome(campanhas) : []), [campanhas])
  const buscaNormalizada = buscaCampanha.trim().toLowerCase()
  const agregadasFiltradas = buscaNormalizada
    ? agregadas.filter((c) => c.nome.toLowerCase().includes(buscaNormalizada))
    : agregadas

  function toggleCampanha(nome: string) {
    setCampanhasMeta((prev) => (prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]))
  }

  function toggleCasa(casaId: string) {
    setCasas((prev) => (prev.includes(casaId) ? prev.filter((id) => id !== casaId) : [...prev, casaId]))
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
      tipo,
      casas,
      campanhasMeta,
    })
    await new Promise((r) => setTimeout(r, 150))
    setSaving(false)
    onSave()
  }

  return (
    <div className="space-y-3 p-4 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
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
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-20 shrink-0">Tipo:</span>
        <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--border)] rounded p-0.5">
          <button
            type="button"
            onClick={() => setTipo('disparo')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${tipo === 'disparo' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Disparo
          </button>
          <button
            type="button"
            onClick={() => setTipo('traffic')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${tipo === 'traffic' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Tráfego
          </button>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-20 shrink-0 pt-1">Casas:</span>
        <div className="flex-1 flex flex-wrap gap-1.5">
          {casasList.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)]/40 italic">Nenhuma casa cadastrada</span>
          ) : (
            casasList.map((casa) => {
              const selected = casas.includes(casa.id)
              return (
                <button
                  key={casa.id}
                  type="button"
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
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-20 shrink-0 pt-1">
          Campanhas{campanhasMeta.length > 0 ? ` (${campanhasMeta.length})` : ''}:
        </span>
        <div className="flex-1 space-y-1.5">
          {campanhas !== null && agregadas.length > 0 && (
            <input
              type="text"
              value={buscaCampanha}
              onChange={(e) => setBuscaCampanha(e.target.value)}
              placeholder="Buscar campanha por nome..."
              className="w-full h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          )}
          <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded border border-[var(--border)] bg-[var(--bg-base)]">
            {campanhas === null ? (
              <span className="text-xs text-[var(--text-muted)]/50 italic">Carregando campanhas do Meta...</span>
            ) : agregadas.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)]/50 italic">Nenhuma campanha do Meta hoje</span>
            ) : agregadasFiltradas.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)]/50 italic">Nenhuma campanha bate com essa busca</span>
            ) : (
              agregadasFiltradas.map((c) => (
                <label key={c.nome} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campanhasMeta.includes(c.nome)}
                    onChange={() => toggleCampanha(c.nome)}
                    className="shrink-0"
                  />
                  <span className="flex-1 truncate text-[var(--text-primary)]" title={c.nome}>{c.nome}</span>
                  <span className="font-mono text-[var(--text-muted)] shrink-0">{formatMoeda(c.gasto)}</span>
                </label>
              ))
            )}
          </div>
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
  const { list: casasList } = useCasasAposta()
  const [fluxosDisponiveis, setFluxosDisponiveis] = useState<BlacksenderFlow[]>([])
  const [campanhas, setCampanhas] = useState<CampanhaMeta[] | null>(null)
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotHoje>>({})
  const [ultimosLeads, setUltimosLeads] = useState<Record<string, string | null>>({})
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [analiseFlowId, setAnaliseFlowId] = useState<string | null>(null)
  // Guarda a última config vista mesmo depois de analiseFlowId virar null — sem isso o painel de
  // análise perderia o conteúdo (e a animação de saída) no instante em que o usuário fecha, já que
  // a config correspondente some antes do <AnimatePresence> ter a chance de tocar o exit. Setado
  // direto no onClick que abre o painel (não num effect derivado) — evita tanto reler ref durante
  // o render quanto setState síncrono dentro de effect (ambos proibidos pelas regras do projeto).
  const [analiseConfigAtivo, setAnaliseConfigAtivo] = useState<FlowTagConfig | null>(null)
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
        next[cfg.flowId] = {
          leads: snap.leads,
          registros: snap.registros,
          ftds: snap.ftds,
          gasto,
          custoEntrada: snap.custoEntrada ?? null,
          custoRegistro: snap.custoRegistro ?? null,
          custoFtd: snap.custoFtd ?? null,
        }
      }
      setSnapshots(next)
      setCarregando(false)
    })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, hoje, campanhas, saveVersion])

  // Último lead por flow — reaproveita /api/blacksender/fluxos/[flowId] (já ordena por
  // criadoEmOrigem desc), não precisa de endpoint novo só pra isso.
  useEffect(() => {
    let cancelado = false
    Promise.all(
      configs.map((cfg) =>
        fetch(`/api/blacksender/fluxos/${cfg.flowId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => [cfg.flowId, d?.ultimoLeadEm ?? null] as const)
          .catch(() => [cfg.flowId, null] as const),
      ),
    ).then((pares) => {
      if (cancelado) return
      setUltimosLeads(Object.fromEntries(pares))
    })
    return () => { cancelado = true }
  }, [configs, saveVersion])

  function handleSalvo() {
    setModalAberto(false)
    setEditingKey(null)
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
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Layers size={16} className="text-[var(--d1)]" />
          Funis — Black Sender{somentePinados ? ' (fixados)' : ''}
          <span className="text-xs font-normal text-[var(--text-muted)]">{configs.length}</span>
        </h2>
        {!somentePinados && (
          <button
            onClick={() => { setEditingKey(null); setModalAberto(true) }}
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Funil</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">UTM</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Último lead</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Leads hoje</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Reg</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">FTDs</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="FTDs de hoje ÷ Leads hoje">Conv. FTD</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Registros de hoje ÷ Leads hoje">Conv. Reg</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Gasto em campanhas do Meta atribuídas">Gasto</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Gasto em Ads (Meta) ÷ Leads hoje">Custo/Entrada</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Gasto em Ads (Meta) ÷ Registros">Custo/Reg</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Gasto em Ads (Meta) ÷ FTDs">Custo/FTD</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]"></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg) => {
                const snap = snapshots[cfg.flowId]
                const pinado = pinnedFunis.includes(cfg.funil ?? '')
                const nomeFluxo = fluxosDisponiveis.find((f) => f.id === cfg.flowId)?.nome ?? cfg.flowId
                const isEditing = editingKey === cfg.flowId
                const convFtd = snap && snap.leads > 0 ? (snap.ftds / snap.leads) * 100 : null
                const convReg = snap && snap.leads > 0 ? (snap.registros / snap.leads) * 100 : null
                return (
                  <Fragment key={cfg.flowId}>
                    <tr className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {(cfg.casas ?? []).length > 0 && (
                            <div className="flex -space-x-0.5">
                              {(cfg.casas ?? []).slice(0, 3).map((casaId) => {
                                const casa = casasList.find((c) => c.id === casaId)
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
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono max-w-[160px]"
                            style={{ backgroundColor: 'var(--d1)20', border: '1px solid var(--d1)30', color: 'var(--d1)' }}
                            title={nomeFluxo}
                          >
                            <span className="truncate">{cfg.funil || nomeFluxo}</span>
                          </span>
                          <button
                            onClick={() => cfg.funil && togglePinFunil(cfg.funil)}
                            disabled={!cfg.funil}
                            className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-30"
                            title={pinado ? 'Desafixar da Home' : 'Fixar na Home'}
                          >
                            <Pin size={11} className={pinado ? 'text-amber-400' : 'text-[var(--text-muted)]'} fill={pinado ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-left">
                        {cfg.utm ? (
                          <span className="inline-flex items-center max-w-[220px] text-xs rounded px-2 py-1 border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                            <span className="truncate" title={cfg.utm}>{cfg.utm}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]/40">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-mono text-[var(--text-muted)]">
                          {ultimosLeads[cfg.flowId] === undefined ? <Spinner size={12} /> : formatarUltimoLead(ultimosLeads[cfg.flowId])}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {carregando ? <Spinner size={12} /> : (
                          <span className={`font-semibold ${(snap?.leads ?? 0) > 0 ? 'text-[var(--d3)]' : 'text-[var(--text-muted)]'}`}>{snap?.leads ?? 0}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold font-mono ${(snap?.registros ?? 0) > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{snap?.registros ?? 0}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold font-mono ${(snap?.ftds ?? 0) > 0 ? 'text-[var(--d1)]' : 'text-[var(--text-muted)]'}`}>{snap?.ftds ?? 0}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-xs font-mono text-[var(--text-muted)]">{convFtd === null ? '—' : `${convFtd.toFixed(1)}%`}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-xs font-mono text-[var(--text-muted)]">{convReg === null ? '—' : `${convReg.toFixed(1)}%`}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold font-mono ${(snap?.gasto ?? 0) > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                          {snap?.gasto ? formatMoeda(snap.gasto) : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold font-mono ${snap?.custoEntrada ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                          {snap?.custoEntrada ? formatMoeda(snap.custoEntrada) : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-xs font-mono ${snap?.custoRegistro ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                          {snap?.custoRegistro ? formatMoeda(snap.custoRegistro) : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-xs font-mono ${snap?.custoFtd ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                          {snap?.custoFtd ? formatMoeda(snap.custoFtd) : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => { setAnaliseConfigAtivo(cfg); setAnaliseFlowId(cfg.flowId) }}
                            className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                            title="Ver análise e conversas"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => setEditingKey(isEditing ? null : cfg.flowId)}
                            className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                            title="Editar funil"
                          >
                            <Pen size={13} />
                          </button>
                          <button
                            onClick={() => handleRemover(cfg)}
                            title="Desvincular"
                            className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr>
                        <td colSpan={13} className="p-0 border-b border-[var(--glass-border)]">
                          <div className="px-3 py-3">
                            <EditorFunilBlacksender
                              config={cfg}
                              fluxosDisponiveis={fluxosDisponiveis}
                              configsExistentes={configs}
                              campanhas={campanhas}
                              casasList={casasList}
                              onSave={handleSalvo}
                              onClose={() => setEditingKey(null)}
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

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Vincular fluxo da Black Sender">
        <EditorFunilBlacksender
          config={null}
          fluxosDisponiveis={fluxosDisponiveis}
          configsExistentes={configs}
          campanhas={campanhas}
          casasList={casasList}
          onSave={handleSalvo}
          onClose={() => setModalAberto(false)}
        />
      </Modal>

      <PainelAnaliseFunilBlacksender
        aberto={!!analiseFlowId}
        config={analiseConfigAtivo}
        nomeFluxo={analiseConfigAtivo ? fluxosDisponiveis.find((f) => f.id === analiseConfigAtivo.flowId)?.nome ?? analiseConfigAtivo.flowId : ''}
        snapshot={analiseConfigAtivo ? snapshots[analiseConfigAtivo.flowId] ?? null : null}
        onClose={() => setAnaliseFlowId(null)}
      />
    </section>
  )
}
