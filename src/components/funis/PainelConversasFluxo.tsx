'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronRight, CheckCircle2, Funnel, Save, NotebookText, CalendarDays, Plus, MousePointerClick, Copy, Check, DollarSign, Calculator, GitCompare } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { getState, updateFlowTagConfig } from '@/lib/store'
import { adicionarDias, formatarData, parsearDataISO } from '@/lib/datas'
import { buscarResultadosDoDia, calcularResultadoLinhaNoDia, gerarRangeDatas, tagDeEntradaDoFluxo, type ResultadoLinhaDia } from '@/lib/funis'
import type { KpiBotao, KpiCusto, FlowTagConfig, CasaAposta } from '@/types'
import type { CampanhaMeta } from '@/app/api/meta-ads/campanhas/route'
import { FunilConversaoChart, type EstagioFunil } from './FunilConversaoChart'
import { LeadConversaDetalhe, formatarTempoRelativo, type LeadComConversa } from './LeadConversaCard'

const LARGURA_METRICAS = 420
const LARGURA_COLUNA_COMPARACAO = 380
const LARGURA_LEAD_DETALHE = 440
const LARGURA_LISTA = 420
// Referência estável pro caso "sem KPIs"/"sem campanhas" — useSyncExternalStore exige que
// getSnapshot devolva a mesma referência quando nada mudou; um `[]` literal inline criaria um
// array novo a cada chamada e disparava um loop infinito de re-render.
const KPIS_BOTAO_VAZIO: KpiBotao[] = []
const CAMPANHAS_META_VAZIO: string[] = []
const KPIS_CUSTO_VAZIO: KpiCusto[] = []

function formatarDataCurta(iso: string): string {
  return formatarData(parsearDataISO(iso), 'DD/MM')
}

function PainelAnotacoes({ flowId, direita, onClose }: { flowId: string; direita: number; onClose: () => void }) {
  const [comentarios, setComentarios] = useState('')
  const [salvo, setSalvo] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const atual = getState().flowTagConfigs[flowId]?.comentarios ?? ''
    setComentarios(atual)
    setSalvo(atual)
  }, [flowId])

  async function salvar() {
    const configAtual = getState().flowTagConfigs[flowId]
    if (!configAtual) return
    setSalvando(true)
    updateFlowTagConfig({ ...configAtual, comentarios })
    await new Promise((r) => setTimeout(r, 200))
    setSalvo(comentarios)
    setSalvando(false)
  }

  const mudou = comentarios !== salvo

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0, right: direita }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-y-0 z-50 w-[380px] max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
          <NotebookText size={14} className="text-[var(--text-muted)]" />
          Anotações
        </h2>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        <p className="text-xs text-[var(--text-muted)]">Observações sobre esse funil — fica salvo, visível sempre que você abrir os detalhes dele, sem depender do período selecionado.</p>
        <textarea
          value={comentarios}
          onChange={(e) => setComentarios(e.target.value)}
          placeholder="Adicione observações, hipóteses ou próximos passos sobre esse funil..."
          className="flex-1 min-h-[240px] px-3 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors resize-none"
        />
        <button
          onClick={salvar}
          disabled={!mudou || salvando}
          className="flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium text-white disabled:opacity-40 transition-opacity shrink-0"
          style={{ backgroundColor: 'var(--d1)' }}
        >
          <Save size={14} />
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </motion.div>
  )
}

interface PainelConversasFluxoProps {
  aberto: boolean
  onClose: () => void
  botId: string | null
  flowId: string | null
  tag: string | null
  flowNome: string | null
  tags: string[]
  contagensPorTag: Record<string, number>
  cor?: string
  leadsHoje: number
  total: number
  registros: number
  ftds: number
  periodoLabel: string
  dataReferencia: string
  dataInicio: string
  utm: string | null
  utmsExtras: string[]
}

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function MetricaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-center">
      <div className="text-lg font-bold text-[var(--text-primary)]">{value}</div>
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  )
}

function BlocoMetricas({ leads, registros, ftds, total }: { leads: number; registros: number; ftds: number; total: number }) {
  const convReg = leads > 0 ? (registros / leads) * 100 : null
  const convFtd = registros > 0 ? (ftds / registros) * 100 : null
  return (
    <div className="grid grid-cols-3 gap-2">
      <MetricaTile label="Leads" value={formatInt(leads)} />
      <MetricaTile label="Registros" value={formatInt(registros)} />
      <MetricaTile label="FTDs" value={formatInt(ftds)} />
      <MetricaTile label="Conv. Reg" value={convReg === null ? '—' : `${convReg.toFixed(1)}%`} />
      <MetricaTile label="Conv. FTD" value={convFtd === null ? '—' : `${convFtd.toFixed(1)}%`} />
      <MetricaTile label="Total período" value={formatInt(total)} />
    </div>
  )
}

function BlocoFunilChart({ estagios, cor }: { estagios: EstagioFunil[]; cor?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Funnel size={12} className="text-[var(--text-muted)]" />
        <span className="text-xs font-medium text-[var(--text-muted)]">Funil de conversão da jornada</span>
      </div>
      <FunilConversaoChart estagios={estagios} cor={cor} orientacao="vertical" />
    </div>
  )
}

function KpiBotaoTile({
  botId,
  tag,
  flowId,
  kpi,
  dataInicio,
  dataFim,
  onRemover,
}: {
  botId: string
  tag: string
  flowId: string
  kpi: KpiBotao
  dataInicio: string
  dataFim: string
  onRemover?: () => void
}) {
  const [contagem, setContagem] = useState<number | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch('/api/sendpulse/contagem-botao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId, tag, flowId, botaoTitulo: kpi.botaoTitulo, tipo: kpi.tipo, dataInicio, dataFim }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setErro(true); return }
        setContagem(data.contagem ?? 0)
      })
      .catch(() => setErro(true))
  }, [botId, tag, flowId, kpi.botaoTitulo, kpi.tipo, dataInicio, dataFim])

  return (
    <div className="relative">
      <MetricaTile label={kpi.nome} value={erro ? '—' : contagem === null ? '···' : formatInt(contagem)} />
      {onRemover && (
        <button
          onClick={onRemover}
          title="Remover KPI"
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

function BlocoKpisBotao({
  kpis,
  botId,
  tag,
  flowId,
  dataInicio,
  dataFim,
  onRemover,
}: {
  kpis: KpiBotao[]
  botId: string
  tag: string
  flowId: string
  dataInicio: string
  dataFim: string
  onRemover?: (id: string) => void
}) {
  if (kpis.length === 0) return null
  return (
    <div className="grid grid-cols-3 gap-2">
      {kpis.map((kpi) => (
        <KpiBotaoTile
          key={`${kpi.id}-${dataInicio}-${dataFim}`}
          botId={botId}
          tag={tag}
          flowId={flowId}
          kpi={kpi}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onRemover={onRemover ? () => onRemover(kpi.id) : undefined}
        />
      ))}
    </div>
  )
}

function agregarCampanhasPorNome(campanhas: CampanhaMeta[]): { nome: string; gasto: number; cliquesLink: number }[] {
  const mapa = new Map<string, { gasto: number; cliquesLink: number }>()
  for (const c of campanhas) {
    const atual = mapa.get(c.nome) ?? { gasto: 0, cliquesLink: 0 }
    atual.gasto += c.gasto
    atual.cliquesLink += c.cliquesLink
    mapa.set(c.nome, atual)
  }
  return [...mapa.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.gasto - a.gasto)
}

function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Gasto em Meta Ads do funil no período — como o nome de campanha não segue um padrão
 * confiável (ver comentário na rota /api/meta-ads/campanhas), a atribuição campanha -> funil é
 * manual: busca todas as campanhas do período e deixa marcar quais pertencem a esse funil,
 * somando o gasto só das marcadas. A partir do gasto total, deriva Custo/Registro e Custo/FTD
 * automaticamente, e permite criar KPIs de custo por tag (ex: custo por CTA). */
function BlocoGastoMeta({
  flowId,
  dataInicio,
  dataFim,
  registros,
  ftds,
  tags,
  contagensPorTag,
  editavel,
}: {
  flowId: string
  dataInicio: string
  dataFim: string
  registros: number
  ftds: number
  tags: string[]
  contagensPorTag: Record<string, number>
  editavel?: boolean
}) {
  const [campanhas, setCampanhas] = useState<CampanhaMeta[] | null>(null)
  const [erro, setErro] = useState(false)
  const [checklistAberto, setChecklistAberto] = useState(false)
  const [buscaCampanha, setBuscaCampanha] = useState('')
  const [formKpiCustoAberto, setFormKpiCustoAberto] = useState(false)
  const [tagEscolhidaCusto, setTagEscolhidaCusto] = useState('')
  const [nomeKpiCustoNovo, setNomeKpiCustoNovo] = useState('')

  useEffect(() => {
    // Guarda contra a dupla invocação do StrictMode em dev: sem isso, se a primeira chamada
    // (já cancelada) responder DEPOIS da segunda (a que realmente vale), ela sobrescreve o
    // resultado bom com erro.
    let ativo = true
    fetch(`/api/meta-ads/campanhas?from=${dataInicio}&to=${dataFim}`)
      .then((r) => r.json())
      .then((data) => {
        if (!ativo) return
        if (data.error) { setErro(true); return }
        setCampanhas(data.campanhas ?? [])
      })
      .catch(() => { if (ativo) setErro(true) })
    return () => { ativo = false }
  }, [dataInicio, dataFim])

  const campanhasAtribuidas = useSyncExternalStore(
    (cb) => { window.addEventListener('nico:state-changed', cb); return () => window.removeEventListener('nico:state-changed', cb) },
    () => getState().flowTagConfigs[flowId]?.campanhasMeta ?? CAMPANHAS_META_VAZIO,
    () => CAMPANHAS_META_VAZIO,
  )
  const kpisCusto = useSyncExternalStore(
    (cb) => { window.addEventListener('nico:state-changed', cb); return () => window.removeEventListener('nico:state-changed', cb) },
    () => getState().flowTagConfigs[flowId]?.kpisCusto ?? KPIS_CUSTO_VAZIO,
    () => KPIS_CUSTO_VAZIO,
  )

  const agregadas = useMemo(() => (campanhas ? agregarCampanhasPorNome(campanhas) : []), [campanhas])
  const gastoTotal = agregadas.filter((c) => campanhasAtribuidas.includes(c.nome)).reduce((soma, c) => soma + c.gasto, 0)
  const buscaCampanhaNormalizada = buscaCampanha.trim().toLowerCase()
  const agregadasFiltradas = buscaCampanhaNormalizada
    ? agregadas.filter((c) => c.nome.toLowerCase().includes(buscaCampanhaNormalizada))
    : agregadas
  const custoRegistro = gastoTotal > 0 && registros > 0 ? gastoTotal / registros : null
  const custoFtd = gastoTotal > 0 && ftds > 0 ? gastoTotal / ftds : null

  function toggleCampanha(nome: string) {
    const configAtual = getState().flowTagConfigs[flowId]
    if (!configAtual) return
    const atuais = configAtual.campanhasMeta ?? []
    const novas = atuais.includes(nome) ? atuais.filter((n) => n !== nome) : [...atuais, nome]
    updateFlowTagConfig({ ...configAtual, campanhasMeta: novas })
  }

  function adicionarKpiCusto() {
    if (!tagEscolhidaCusto) return
    const configAtual = getState().flowTagConfigs[flowId]
    if (!configAtual) return
    const novo: KpiCusto = { id: crypto.randomUUID(), nome: nomeKpiCustoNovo.trim() || `Custo ${tagEscolhidaCusto}`, tag: tagEscolhidaCusto }
    updateFlowTagConfig({ ...configAtual, kpisCusto: [...(configAtual.kpisCusto ?? []), novo] })
    setTagEscolhidaCusto('')
    setNomeKpiCustoNovo('')
    setFormKpiCustoAberto(false)
  }

  function removerKpiCusto(id: string) {
    const configAtual = getState().flowTagConfigs[flowId]
    if (!configAtual) return
    updateFlowTagConfig({ ...configAtual, kpisCusto: (configAtual.kpisCusto ?? []).filter((k) => k.id !== id) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
          <DollarSign size={12} />
          Gasto em Ads (Meta)
        </span>
        {editavel && (
          <button
            onClick={() => setChecklistAberto((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {checklistAberto ? 'Fechar' : 'Atribuir campanhas'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricaTile
          label={`Gasto${campanhasAtribuidas.length > 0 ? ` (${campanhasAtribuidas.length} camp.)` : ''}`}
          value={erro ? '—' : campanhas === null ? '···' : formatMoeda(gastoTotal)}
        />
        <MetricaTile label="Custo/Reg" value={custoRegistro === null ? '—' : formatMoeda(custoRegistro)} />
        <MetricaTile label="Custo/FTD" value={custoFtd === null ? '—' : formatMoeda(custoFtd)} />
      </div>
      {editavel && checklistAberto && (
        <div className="space-y-1.5">
          {campanhas !== null && agregadas.length > 0 && (
            <input
              type="text"
              value={buscaCampanha}
              onChange={(e) => setBuscaCampanha(e.target.value)}
              placeholder="Buscar campanha..."
              className="w-full text-[11px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          )}
          <div className="max-h-56 overflow-y-auto space-y-1 p-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)]">
            {campanhas === null ? (
              <div className="flex items-center justify-center py-6">
                <Spinner size={16} />
              </div>
            ) : agregadas.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)]">Nenhuma campanha encontrada nesse período.</p>
            ) : agregadasFiltradas.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)]">Nenhuma campanha bate com essa busca.</p>
            ) : (
              agregadasFiltradas.map((c) => (
                <label key={c.nome} className="flex items-center gap-2 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campanhasAtribuidas.includes(c.nome)}
                    onChange={() => toggleCampanha(c.nome)}
                    className="shrink-0"
                  />
                  <span className="flex-1 truncate text-[var(--text-secondary)]" title={c.nome}>{c.nome}</span>
                  <span className="font-mono text-[var(--text-muted)] shrink-0">{formatMoeda(c.gasto)}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {editavel && (
        <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
            <Calculator size={12} />
            KPIs de custo
          </span>
          <button
            onClick={() => setFormKpiCustoAberto((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Plus size={11} />
            Novo KPI
          </button>
        </div>
      )}
      {editavel && formKpiCustoAberto && (
        <div className="flex items-center gap-1.5 flex-wrap p-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)]">
          <select
            value={tagEscolhidaCusto}
            onChange={(e) => setTagEscolhidaCusto(e.target.value)}
            className="text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-primary)] outline-none"
          >
            <option value="">Selecione uma tag...</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={nomeKpiCustoNovo}
            onChange={(e) => setNomeKpiCustoNovo(e.target.value)}
            placeholder="Nome do KPI (opcional)"
            className="text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] flex-1 min-w-[120px] outline-none"
          />
          <button
            onClick={adicionarKpiCusto}
            disabled={!tagEscolhidaCusto}
            className="text-[11px] font-medium px-2 py-1 rounded disabled:opacity-40 text-white transition-opacity"
            style={{ backgroundColor: 'var(--d1)' }}
          >
            Adicionar
          </button>
          <button onClick={() => setFormKpiCustoAberto(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={12} />
          </button>
        </div>
      )}
      {kpisCusto.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {kpisCusto.map((kpi) => {
            const contagem = contagensPorTag[kpi.tag] ?? 0
            const custo = gastoTotal > 0 && contagem > 0 ? gastoTotal / contagem : null
            return (
              <div key={kpi.id} className="relative">
                <MetricaTile label={kpi.nome} value={custo === null ? '—' : formatMoeda(custo)} />
                {editavel && (
                  <button
                    onClick={() => removerKpiCusto(kpi.id)}
                    title="Remover KPI"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Combobox pesquisável pra escolher um funil na comparação — o app tem dezenas de funis
 * configurados, um <select> nativo fica ruim de usar (lista gigante sem busca). Mesmo padrão
 * de interação do TagComboBox (ui/TagComboBox.tsx). */
function FunilComboBox({ opcoes, onSelect }: { opcoes: FlowTagConfig[]; onSelect: (flowId: string) => void }) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const termo = busca.trim().toLowerCase()
  const filtradas = termo ? opcoes.filter((f) => (f.funil ?? '').toLowerCase().includes(termo)) : opcoes

  function selecionar(flowIdEscolhido: string) {
    onSelect(flowIdEscolhido)
    setBusca('')
    setAberto(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        placeholder="Buscar funil..."
        className="text-[11px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-[160px]"
      />
      {aberto && (
        <div className="absolute top-full right-0 z-50 mt-1 w-[240px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtradas.length === 0 ? (
            <div className="px-3 py-1.5 text-[11px] text-[var(--text-muted)]">Nenhum funil encontrado.</div>
          ) : (
            filtradas.map((f) => (
              <button
                key={f.flowId}
                type="button"
                onClick={() => selecionar(f.flowId)}
                className="block w-full px-3 py-1.5 text-[11px] text-left text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors truncate"
              >
                {f.funil}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function PainelConversasFluxo({
  aberto,
  onClose,
  botId,
  flowId,
  tag,
  flowNome,
  tags,
  contagensPorTag,
  cor,
  leadsHoje,
  total,
  registros,
  ftds,
  periodoLabel,
  dataReferencia,
  dataInicio,
  utm,
  utmsExtras,
}: PainelConversasFluxoProps) {
  const [leads, setLeads] = useState<LeadComConversa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [leadSelecionado, setLeadSelecionado] = useState<LeadComConversa | null>(null)
  const [dataComparacao, setDataComparacao] = useState<string | null>(null)
  const [formKpiAberto, setFormKpiAberto] = useState(false)
  const [botaoEscolhido, setBotaoEscolhido] = useState('')
  const [nomeKpiNovo, setNomeKpiNovo] = useState('')
  const [flowIdCopiado, setFlowIdCopiado] = useState(false)
  const [tagFiltro, setTagFiltro] = useState(tag ?? '')
  const [buscaLeadId, setBuscaLeadId] = useState('')
  // Guarda a data a que o resultado se refere junto com o resultado — permite derivar "carregando"
  // (dataComparacao mudou mas ainda não tem resultado pra essa data) sem precisar de setState
  // síncrono no corpo do effect pra sinalizar início de carregamento.
  const [resultadoComparacao, setResultadoComparacao] = useState<{ data: string; resultado: ResultadoLinhaDia | null; leadsPorTag: Record<string, number> | null; erro: string | null } | null>(null)
  const [todosFunis, setTodosFunis] = useState<FlowTagConfig[]>([])
  const [funisComparados, setFunisComparados] = useState<string[]>([])
  type ResultadoFunilComparado = { leads: number; registros: number; ftds: number; contagensPorTag: Record<string, number> }
  const [resultadosFunisComparados, setResultadosFunisComparados] = useState<Record<string, ResultadoFunilComparado | null>>({})

  // Lista de funis configurados (pra montar o picker de "comparar com outro funil") — busca só
  // uma vez quando o painel abre, não depende do período selecionado.
  useEffect(() => {
    if (!aberto) return
    let ativo = true
    fetch('/api/flow-tag-configs')
      .then((r) => r.json())
      .then((data) => {
        if (!ativo) return
        const configs = (data.configs ?? []) as FlowTagConfig[]
        setTodosFunis(configs.filter((c) => c.funil))
      })
      .catch(() => {})
    return () => { ativo = false }
  }, [aberto])

  // Resultado (leads/registros/ftds/contagem por tag) de cada funil comparado, somado dia a dia
  // no MESMO período selecionado pro funil principal — mesma lógica de agregação usada em
  // /funis/apresentar pra comparar vários funis ao longo de um intervalo.
  useEffect(() => {
    if (funisComparados.length === 0) return
    let ativo = true
    const datas = gerarRangeDatas(dataInicio, dataReferencia)
    Promise.all(
      funisComparados.map(async (flowIdComparado): Promise<[string, ResultadoFunilComparado | null]> => {
        const config = todosFunis.find((f) => f.flowId === flowIdComparado)
        if (!config) return [flowIdComparado, null]
        const tagEntrada = tagDeEntradaDoFluxo(config.tags)
        const dias = await Promise.all(
          datas.map((data) => buscarResultadosDoDia(data, [{ botId: config.botId, tags: config.tags }])),
        )
        let leads = 0
        let registros = 0
        let ftds = 0
        const contagensPorTag: Record<string, number> = {}
        for (const dia of dias) {
          const r = calcularResultadoLinhaNoDia(config, dia)
          leads += tagEntrada ? (dia.leadsPorTag[tagEntrada] ?? 0) : 0
          registros += r.registros
          ftds += r.ftds
          for (const [t, c] of Object.entries(dia.leadsPorTag)) contagensPorTag[t] = (contagensPorTag[t] ?? 0) + c
        }
        return [flowIdComparado, { leads, registros, ftds, contagensPorTag }]
      }),
    ).then((entradas) => {
      if (!ativo) return
      setResultadosFunisComparados(Object.fromEntries(entradas))
    })
    return () => { ativo = false }
  }, [funisComparados, dataInicio, dataReferencia, todosFunis])

  useEffect(() => {
    if (!aberto || !botId || !flowId || !tag) return
    const params = new URLSearchParams({ botId, flowId, tag, tagFiltro: tagFiltro || tag, quantidade: '50' })
    fetch(`/api/sendpulse/ultimas-conversas-fluxo?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setErro(data.error); setLeads([]); return }
        setLeads(data.leads ?? [])
      })
      .catch(() => setErro('Erro ao buscar conversas'))
      .finally(() => setCarregando(false))
  }, [aberto, botId, flowId, tag, tagFiltro])

  useEffect(() => {
    if (!dataComparacao || !botId || tags.length === 0) return
    const dataAlvo = dataComparacao
    buscarResultadosDoDia(dataAlvo, [{ botId, tags }])
      .then((dia) => {
        const resultado = calcularResultadoLinhaNoDia({ tags, utm, utmsExtras }, dia)
        setResultadoComparacao({ data: dataAlvo, resultado, leadsPorTag: dia.leadsPorTag, erro: null })
      })
      .catch(() => setResultadoComparacao({ data: dataAlvo, resultado: null, leadsPorTag: null, erro: 'Erro ao buscar comparação' }))
  }, [dataComparacao, botId, tags, utm, utmsExtras])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Escape fecha o detalhe primeiro (se tiver aberto) — só fecha o painel inteiro no segundo Escape.
      if (leadSelecionado) setLeadSelecionado(null)
      else onClose()
    }
    if (aberto) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [aberto, onClose, leadSelecionado])

  function fechar() {
    setLeadSelecionado(null)
    onClose()
  }

  function alternarDataComparacao(d: string) {
    setDataComparacao((atual) => (atual === d ? null : d))
  }

  function copiarFlowId() {
    if (!flowId) return
    navigator.clipboard.writeText(flowId)
    setFlowIdCopiado(true)
    setTimeout(() => setFlowIdCopiado(false), 1500)
  }

  function adicionarFunilComparado(flowIdEscolhido: string) {
    if (!flowIdEscolhido || funisComparados.includes(flowIdEscolhido) || funisComparados.length >= 2) return
    setFunisComparados((prev) => [...prev, flowIdEscolhido])
  }

  function removerFunilComparado(flowIdRemovido: string) {
    setFunisComparados((prev) => prev.filter((id) => id !== flowIdRemovido))
  }

  const kpisBotao = useSyncExternalStore(
    (cb) => { window.addEventListener('nico:state-changed', cb); return () => window.removeEventListener('nico:state-changed', cb) },
    () => (flowId ? getState().flowTagConfigs[flowId]?.kpisBotao ?? KPIS_BOTAO_VAZIO : KPIS_BOTAO_VAZIO),
    () => KPIS_BOTAO_VAZIO,
  )

  // Botões distintos (com ou sem link) que já apareceram nas conversas carregadas — usado como
  // opções pro picker de "novo KPI". Como o texto de um botão é fixo no fluxo (não muda por
  // lead), a amostra de conversas já carregada normalmente cobre todos eles.
  const botoesDisponiveis = useMemo(() => {
    const mapa = new Map<string, 'botao' | 'link'>()
    for (const lead of leads) {
      for (const msg of lead.mensagens) {
        if (msg.botoesOferecidos) for (const b of msg.botoesOferecidos) if (!mapa.has(b)) mapa.set(b, 'botao')
        if (msg.tipo === 'link_enviado' && msg.linkTexto && !mapa.has(msg.linkTexto)) mapa.set(msg.linkTexto, 'link')
      }
    }
    return [...mapa.entries()].map(([botaoTitulo, tipo]) => ({ botaoTitulo, tipo }))
  }, [leads])

  function adicionarKpiBotao() {
    if (!flowId || !botaoEscolhido) return
    const configAtual = getState().flowTagConfigs[flowId]
    if (!configAtual) return
    const escolhido = botoesDisponiveis.find((b) => b.botaoTitulo === botaoEscolhido)
    if (!escolhido) return
    const novo: KpiBotao = { id: crypto.randomUUID(), nome: nomeKpiNovo.trim() || escolhido.botaoTitulo, botaoTitulo: escolhido.botaoTitulo, tipo: escolhido.tipo }
    updateFlowTagConfig({ ...configAtual, kpisBotao: [...(configAtual.kpisBotao ?? []), novo] })
    setBotaoEscolhido('')
    setNomeKpiNovo('')
    setFormKpiAberto(false)
  }

  function removerKpiBotao(id: string) {
    if (!flowId) return
    const configAtual = getState().flowTagConfigs[flowId]
    if (!configAtual) return
    updateFlowTagConfig({ ...configAtual, kpisBotao: (configAtual.kpisBotao ?? []).filter((k) => k.id !== id) })
  }

  const estagios = tags.map((t) => ({ tag: t, contagem: contagensPorTag[t] ?? 0 }))

  // Filtra a amostra de leads já carregada pelo lead_id (variável salva pelo próprio fluxo de
  // origem) — útil em fluxos que recebem leads de vários fluxos diferentes (ex: QUIZ SUPER),
  // onde a tag sozinha não distingue de qual fluxo original cada lead veio.
  const buscaLeadIdNormalizada = buscaLeadId.trim().toLowerCase()
  const leadsFiltrados = buscaLeadIdNormalizada
    ? leads.filter((l) => String(l.variaveis?.lead_id ?? '').toLowerCase().includes(buscaLeadIdNormalizada))
    : leads

  // resultadoComparacao só é válido pra exibição se corresponder à data selecionada agora —
  // enquanto isso não bate, ainda está carregando (ou o usuário trocou de data de novo).
  const comparacaoPronta = dataComparacao !== null && resultadoComparacao?.data === dataComparacao
  const carregandoComparacao = dataComparacao !== null && !comparacaoPronta
  const erroComparacao = comparacaoPronta ? resultadoComparacao!.erro : null
  const resultadoDiaComparacao = comparacaoPronta ? resultadoComparacao!.resultado : null
  const leadsPorTagComparacao = comparacaoPronta ? resultadoComparacao!.leadsPorTag : null
  const estagiosComparacao = leadsPorTagComparacao ? tags.map((t) => ({ tag: t, contagem: leadsPorTagComparacao[t] ?? 0 })) : []

  const dataOntem = formatarData(adicionarDias(parsearDataISO(dataReferencia), -1), 'YYYY-MM-DD')
  const dataSemanaPassada = formatarData(adicionarDias(parsearDataISO(dataReferencia), -7), 'YYYY-MM-DD')

  const funisDisponiveisParaComparar = todosFunis.filter((f) => f.flowId !== flowId && !funisComparados.includes(f.flowId))

  function corDoFunil(config: FlowTagConfig): string | undefined {
    const primeiraId = config.casas?.[0]
    if (!primeiraId) return undefined
    return (getState().casasAposta as Record<string, CasaAposta>)[primeiraId]?.cor
  }

  // Painéis empilhados da direita pra esquerda: lista -> (detalhe do lead, se selecionado) ->
  // métricas/funil -> anotações. Cada um calcula seu offset a partir da largura dos anteriores,
  // pra não deixar gap nem sobrepor quando o detalhe do lead abre/fecha. A largura do painel de
  // métricas/funil também varia — alarga conforme o total de colunas mostradas lado a lado (dia
  // comparado + funis comparados), até um total de 4 (principal + 1 dia + 2 funis).
  const totalColunas = 1 + (dataComparacao ? 1 : 0) + funisComparados.length
  const larguraMetricas = totalColunas > 1 ? LARGURA_COLUNA_COMPARACAO * totalColunas : LARGURA_METRICAS
  const offsetMetricas = LARGURA_LISTA + (leadSelecionado ? LARGURA_LEAD_DETALHE : 0)
  const offsetAnotacoes = offsetMetricas + larguraMetricas

  return (
    <AnimatePresence>
      {aberto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={fechar}
          />

          <div className="hidden">

            {flowId && (
              <PainelAnotacoes flowId={flowId} direita={offsetAnotacoes} onClose={fechar} />
            )}

          </div>

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0, right: offsetMetricas, width: larguraMetricas }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 z-50 max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-[var(--border)]">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {flowNome || 'Detalhes'}
                  {funisComparados.map((fid) => {
                    const config = todosFunis.find((f) => f.flowId === fid)
                    return config ? <span key={fid} className="text-[var(--text-muted)]"> vs {config.funil}</span> : null
                  })}
                </h2>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Período: {periodoLabel}</p>
                {flowId && (
                  <button
                    onClick={copiarFlowId}
                    title="Copiar Flow ID"
                    className="inline-flex items-center gap-1 mt-1 px-1 py-0.5 -mx-1 rounded text-sm cursor-pointer font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    {flowIdCopiado ? (
                      <><Check size={10} className="text-[var(--success)]" /> <span className="text-[var(--success)]">Copiado</span></>
                    ) : (
                      <><Copy size={10} /> {flowId}</>
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-[var(--text-primary)]">Comparar com outro dia</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => alternarDataComparacao(dataOntem)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${dataComparacao === dataOntem
                      ? 'bg-[var(--d1)]/15 border-[var(--d1)]/40 text-[var(--d1)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]'
                      }`}
                  >
                    Ontem
                  </button>
                  <button
                    onClick={() => alternarDataComparacao(dataSemanaPassada)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${dataComparacao === dataSemanaPassada
                      ? 'bg-[var(--d1)]/15 border-[var(--d1)]/40 text-[var(--d1)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]'
                      }`}
                  >
                    Mesma data sem. passada
                  </button>
                  <label className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)] cursor-pointer">
                    <CalendarDays size={11} />
                    <input
                      type="date"
                      value={dataComparacao ?? ''}
                      max={dataReferencia}
                      onChange={(e) => setDataComparacao(e.target.value || null)}
                      className="bg-transparent outline-none [color-scheme:dark] w-[86px]"
                    />
                  </label>
                  {dataComparacao && (
                    <button onClick={() => setDataComparacao(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                    <GitCompare size={12} />
                    Comparar com outro funil
                  </span>
                  {funisComparados.length < 2 && funisDisponiveisParaComparar.length > 0 && (
                    <FunilComboBox opcoes={funisDisponiveisParaComparar} onSelect={adicionarFunilComparado} />
                  )}
                </div>
                {funisComparados.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {funisComparados.map((fid) => {
                      const config = todosFunis.find((f) => f.flowId === fid)
                      return (
                        <span
                          key={fid}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                        >
                          {config?.funil ?? fid}
                          <button onClick={() => removerFunilComparado(fid)} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                            <X size={10} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {botId && tag && flowId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                      <MousePointerClick size={12} />
                      KPIs de clique
                    </span>
                    <button
                      onClick={() => setFormKpiAberto((v) => !v)}
                      className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Plus size={11} />
                      Novo KPI
                    </button>
                  </div>
                  {formKpiAberto && (
                    <div className="flex items-center gap-1.5 flex-wrap p-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)]">
                      {botoesDisponiveis.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-muted)]">Nenhum botão encontrado ainda nas conversas carregadas.</p>
                      ) : (
                        <>
                          <select
                            value={botaoEscolhido}
                            onChange={(e) => setBotaoEscolhido(e.target.value)}
                            className="text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-primary)] outline-none"
                          >
                            <option value="">Selecione um botão...</option>
                            {botoesDisponiveis.map((b) => (
                              <option key={b.botaoTitulo} value={b.botaoTitulo}>
                                {b.botaoTitulo}{b.tipo === 'link' ? ' (link)' : ''}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={nomeKpiNovo}
                            onChange={(e) => setNomeKpiNovo(e.target.value)}
                            placeholder="Nome do KPI (opcional)"
                            className="text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] flex-1 min-w-[120px] outline-none"
                          />
                          <button
                            onClick={adicionarKpiBotao}
                            disabled={!botaoEscolhido}
                            className="text-[11px] font-medium px-2 py-1 rounded disabled:opacity-40 text-white transition-opacity"
                            style={{ backgroundColor: 'var(--d1)' }}
                          >
                            Adicionar
                          </button>
                        </>
                      )}
                      <button onClick={() => setFormKpiAberto(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                {dataComparacao && (
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Comparação · {formatarDataCurta(dataComparacao)}</div>
                    {carregandoComparacao ? (
                      <div className="flex items-center justify-center py-10">
                        <Spinner size={16} />
                      </div>
                    ) : erroComparacao ? (
                      <p className="text-[11px] text-[var(--error)]">{erroComparacao}</p>
                    ) : (
                      <>
                        <BlocoMetricas
                          leads={resultadoDiaComparacao?.leads ?? 0}
                          registros={resultadoDiaComparacao?.registros ?? 0}
                          ftds={resultadoDiaComparacao?.ftds ?? 0}
                          total={resultadoDiaComparacao?.leads ?? 0}
                        />
                        {botId && tag && flowId && (
                          <BlocoKpisBotao kpis={kpisBotao} botId={botId} tag={tag} flowId={flowId} dataInicio={dataComparacao} dataFim={dataComparacao} />
                        )}
                        {flowId && (
                          <BlocoGastoMeta
                            flowId={flowId}
                            dataInicio={dataComparacao}
                            dataFim={dataComparacao}
                            registros={resultadoDiaComparacao?.registros ?? 0}
                            ftds={resultadoDiaComparacao?.ftds ?? 0}
                            tags={tags}
                            contagensPorTag={leadsPorTagComparacao ?? {}}
                          />
                        )}
                        <BlocoFunilChart estagios={estagiosComparacao} cor={cor} />
                      </>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-4">
                  {totalColunas > 1 && (
                    <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">{flowNome} · {periodoLabel}</div>
                  )}
                  <BlocoMetricas leads={leadsHoje} registros={registros} ftds={ftds} total={total} />
                  {botId && tag && flowId && (
                    <BlocoKpisBotao kpis={kpisBotao} botId={botId} tag={tag} flowId={flowId} dataInicio={dataInicio} dataFim={dataReferencia} onRemover={removerKpiBotao} />
                  )}
                  {flowId && (
                    <BlocoGastoMeta
                      flowId={flowId}
                      dataInicio={dataInicio}
                      dataFim={dataReferencia}
                      registros={registros}
                      ftds={ftds}
                      tags={tags}
                      contagensPorTag={contagensPorTag}
                      editavel
                    />
                  )}
                  <BlocoFunilChart estagios={estagios} cor={cor} />
                </div>
                {funisComparados.map((flowIdComparado) => {
                  const config = todosFunis.find((f) => f.flowId === flowIdComparado)
                  const resultado = resultadosFunisComparados[flowIdComparado]
                  if (!config) return null
                  const estagiosComparado = resultado ? config.tags.map((t) => ({ tag: t, contagem: resultado.contagensPorTag[t] ?? 0 })) : []
                  return (
                    <div key={flowIdComparado} className="flex-1 min-w-0 space-y-4">
                      <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">{config.funil} · {periodoLabel}</div>
                      {!resultado ? (
                        <div className="flex items-center justify-center py-10">
                          <Spinner size={16} />
                        </div>
                      ) : (
                        <>
                          <BlocoMetricas leads={resultado.leads} registros={resultado.registros} ftds={resultado.ftds} total={resultado.leads} />
                          <BlocoGastoMeta
                            flowId={config.flowId}
                            dataInicio={dataInicio}
                            dataFim={dataReferencia}
                            registros={resultado.registros}
                            ftds={resultado.ftds}
                            tags={config.tags}
                            contagensPorTag={resultado.contagensPorTag}
                          />
                          <BlocoFunilChart estagios={estagiosComparado} cor={corDoFunil(config)} />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {leadSelecionado && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 right-[420px] z-50 w-[440px] max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-[var(--border)]">
                <button
                  className="flex items-center gap-1.5 min-w-0 text-left text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{leadSelecionado.nome || leadSelecionado.contactId}</h2>
                    <p className="text-md text-[var(--text-muted)]">{formatarTempoRelativo(leadSelecionado.ultimaAtividade)}</p>
                  </div>
                </button>
                <button  onClick={() => setLeadSelecionado(null)} className="hover:text-[var(--text-primary)] cursor-pointer transition-colors shrink-0 px-4 py-2">
                  <ChevronRight size={20} className="shrink-0 text-text-primary" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <LeadConversaDetalhe lead={leadSelecionado} />
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
          >
            <div className="px-4 py-3.5 border-b border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Conversas ao vivo</h2>
                  {flowNome && (
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                      {flowNome} · {buscaLeadIdNormalizada ? `${leadsFiltrados.length} de ${leads.length} leads` : 'últimos 50 leads'}
                    </p>
                  )}
                </div>
                <button onClick={fechar} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                  <X size={16} />
                </button>
              </div>
              {tags.length > 1 && (
                <select
                  value={tagFiltro}
                  onChange={(e) => { setTagFiltro(e.target.value); setCarregando(true) }}
                  className="w-full text-[11px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] outline-none"
                >
                  {tags.map((t) => (
                    <option key={t} value={t}>Tag: {t}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={buscaLeadId}
                onChange={(e) => setBuscaLeadId(e.target.value)}
                placeholder="Filtrar por lead_id (ex: f71-02)..."
                className="w-full text-[11px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {carregando ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size={20} />
                </div>
              ) : erro ? (
                <p className="text-xs text-[var(--error)] text-center py-10">{erro}</p>
              ) : leads.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-10">Nenhuma conversa encontrada pra esse fluxo ainda.</p>
              ) : leadsFiltrados.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-10">Nenhum lead com esse lead_id nos {leads.length} carregados.</p>
              ) : (
                leadsFiltrados.map((lead) => {
                  const cliques = lead.mensagens.filter((m) => m.tipo === 'botao_clicado' || m.tipo === 'lista_selecionada').length
                  const links = lead.mensagens.filter((m) => m.tipo === 'link_enviado').length
                  const selecionado = leadSelecionado?.contactId === lead.contactId
                  return (
                    <button
                      key={lead.contactId}
                      onClick={() => setLeadSelecionado(lead)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${selecionado
                        ? 'bg-[var(--d1)]/10 border-[var(--d1)]/40'
                        : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-elevated)]'
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{lead.nome || lead.contactId}</div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {lead.mensagens.length} msg · {cliques} clique(s) · {links} link(s) · {formatarTempoRelativo(lead.ultimaAtividade)}
                        </div>
                        {lead.tagCliqueLink && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--success)] mt-1">
                            <CheckCircle2 size={11} />
                            Clicou no link ({lead.tagCliqueLink})
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
