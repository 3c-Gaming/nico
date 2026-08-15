'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronRight, CheckCircle2, Funnel, Save, NotebookText, CalendarDays, Plus, MousePointerClick, Copy, Check } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { getState, updateFlowTagConfig } from '@/lib/store'
import { adicionarDias, formatarData, parsearDataISO } from '@/lib/datas'
import { buscarResultadosDoDia, calcularResultadoLinhaNoDia, type ResultadoLinhaDia } from '@/lib/funis'
import type { KpiBotao } from '@/types'
import { FunilConversaoChart, type EstagioFunil } from './FunilConversaoChart'
import { LeadConversaDetalhe, formatarTempoRelativo, type LeadComConversa } from './LeadConversaCard'

const LARGURA_METRICAS = 420
const LARGURA_METRICAS_COMPARACAO = 760
const LARGURA_LEAD_DETALHE = 440
const LARGURA_LISTA = 420
// Referência estável pro caso "sem KPIs" — useSyncExternalStore exige que getSnapshot devolva a
// mesma referência quando nada mudou; um `[]` literal inline criaria um array novo a cada
// chamada e disparava um loop infinito de re-render.
const KPIS_BOTAO_VAZIO: KpiBotao[] = []

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
  // Guarda a data a que o resultado se refere junto com o resultado — permite derivar "carregando"
  // (dataComparacao mudou mas ainda não tem resultado pra essa data) sem precisar de setState
  // síncrono no corpo do effect pra sinalizar início de carregamento.
  const [resultadoComparacao, setResultadoComparacao] = useState<{ data: string; resultado: ResultadoLinhaDia | null; leadsPorTag: Record<string, number> | null; erro: string | null } | null>(null)

  useEffect(() => {
    if (!aberto || !botId || !flowId || !tag) return
    const params = new URLSearchParams({ botId, flowId, tag, quantidade: '50' })
    fetch(`/api/sendpulse/ultimas-conversas-fluxo?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setErro(data.error); setLeads([]); return }
        setLeads(data.leads ?? [])
      })
      .catch(() => setErro('Erro ao buscar conversas'))
      .finally(() => setCarregando(false))
  }, [aberto, botId, flowId, tag])

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
467
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

  // Painéis empilhados da direita pra esquerda: lista -> (detalhe do lead, se selecionado) ->
  // métricas/funil -> anotações. Cada um calcula seu offset a partir da largura dos anteriores,
  // pra não deixar gap nem sobrepor quando o detalhe do lead abre/fecha. A largura do painel de
  // métricas/funil também varia — alarga quando uma comparação entre dias está ativa, pra caber
  // os dois funis lado a lado.
  const larguraMetricas = dataComparacao ? LARGURA_METRICAS_COMPARACAO : LARGURA_METRICAS
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
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{flowNome || 'Detalhes'}</h2>
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
                <span className="text-xs font-medium text-[var(--text-muted)]">Comparar com outro dia</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => alternarDataComparacao(dataOntem)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${dataComparacao === dataOntem
                      ? 'bg-[var(--d1)]/15 border-[var(--d1)]/40 text-[var(--d1)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    Ontem
                  </button>
                  <button
                    onClick={() => alternarDataComparacao(dataSemanaPassada)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${dataComparacao === dataSemanaPassada
                      ? 'bg-[var(--d1)]/15 border-[var(--d1)]/40 text-[var(--d1)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    Mesma data sem. passada
                  </button>
                  <label className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] cursor-pointer">
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

              {dataComparacao ? (
                <div className="flex gap-4">
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
                        <BlocoFunilChart estagios={estagiosComparacao} cor={cor} />
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Atual · {periodoLabel}</div>
                    <BlocoMetricas leads={leadsHoje} registros={registros} ftds={ftds} total={total} />
                    {botId && tag && flowId && (
                      <BlocoKpisBotao kpis={kpisBotao} botId={botId} tag={tag} flowId={flowId} dataInicio={dataInicio} dataFim={dataReferencia} onRemover={removerKpiBotao} />
                    )}
                    <BlocoFunilChart estagios={estagios} cor={cor} />
                  </div>
                </div>
              ) : (
                <>
                  <BlocoMetricas leads={leadsHoje} registros={registros} ftds={ftds} total={total} />
                  {botId && tag && flowId && (
                    <BlocoKpisBotao kpis={kpisBotao} botId={botId} tag={tag} flowId={flowId} dataInicio={dataInicio} dataFim={dataReferencia} onRemover={removerKpiBotao} />
                  )}
                  <BlocoFunilChart estagios={estagios} cor={cor} />
                </>
              )}
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
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Conversas ao vivo</h2>
                {flowNome && <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{flowNome} · últimos 50 leads</p>}
              </div>
              <button onClick={fechar} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                <X size={16} />
              </button>
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
              ) : (
                leads.map((lead) => {
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
