'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, CheckCircle2, Funnel, Save, NotebookText } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { getState, updateFlowTagConfig } from '@/lib/store'
import { FunilConversaoChart } from './FunilConversaoChart'
import { LeadConversaDetalhe, formatarTempoRelativo, type LeadComConversa } from './LeadConversaCard'

const LARGURA_METRICAS = 420
const LARGURA_LEAD_DETALHE = 440
const LARGURA_LISTA = 420

function PainelAnotacoes({ flowId, direita, onClose }: { flowId: string; direita: number; onClose: () => void }) {
  // Só roda uma vez por montagem — o pai (PainelConversasFluxo) já remonta com key própria por
  // fluxo, então não precisa de efeito pra ressincronizar quando flowId muda.
  const [comentarios, setComentarios] = useState(() => getState().flowTagConfigs[flowId]?.comentarios ?? '')
  const [salvo, setSalvo] = useState(() => getState().flowTagConfigs[flowId]?.comentarios ?? '')
  const [salvando, setSalvando] = useState(false)

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
}: PainelConversasFluxoProps) {
  const [leads, setLeads] = useState<LeadComConversa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [leadSelecionado, setLeadSelecionado] = useState<LeadComConversa | null>(null)

  useEffect(() => {
    if (!aberto || !botId || !flowId || !tag) return
    const params = new URLSearchParams({ botId, flowId, tag, quantidade: '15' })
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

  const convReg = leadsHoje > 0 ? (registros / leadsHoje) * 100 : null
  const convFtd = registros > 0 ? (ftds / registros) * 100 : null
  const estagios = tags.map((t) => ({ tag: t, contagem: contagensPorTag[t] ?? 0 }))

  // Painéis empilhados da direita pra esquerda: lista -> (detalhe do lead, se selecionado) ->
  // métricas/funil -> anotações. Cada um calcula seu offset a partir da largura dos anteriores,
  // pra não deixar gap nem sobrepor quando o detalhe do lead abre/fecha.
  const offsetMetricas = LARGURA_LISTA + (leadSelecionado ? LARGURA_LEAD_DETALHE : 0)
  const offsetAnotacoes = offsetMetricas + LARGURA_METRICAS

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

          {flowId && (
            <PainelAnotacoes flowId={flowId} direita={offsetAnotacoes} onClose={fechar} />
          )}

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0, right: offsetMetricas }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 z-50 w-[420px] max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{flowNome || 'Detalhes'}</h2>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Período: {periodoLabel}</p>
              </div>
              <button onClick={fechar} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <MetricaTile label="Leads" value={formatInt(leadsHoje)} />
                <MetricaTile label="Registros" value={formatInt(registros)} />
                <MetricaTile label="FTDs" value={formatInt(ftds)} />
                <MetricaTile label="Conv. Reg" value={convReg === null ? '—' : `${convReg.toFixed(1)}%`} />
                <MetricaTile label="Conv. FTD" value={convFtd === null ? '—' : `${convFtd.toFixed(1)}%`} />
                <MetricaTile label="Total período" value={formatInt(total)} />
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Funnel size={12} className="text-[var(--text-muted)]" />
                  <span className="text-xs font-medium text-[var(--text-muted)]">Funil de conversão da jornada</span>
                </div>
                <FunilConversaoChart estagios={estagios} cor={cor} orientacao="vertical" />
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
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
                <button
                  onClick={() => setLeadSelecionado(null)}
                  className="flex items-center gap-1.5 min-w-0 text-left text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ChevronLeft size={16} className="shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{leadSelecionado.nome || leadSelecionado.contactId}</h2>
                    <p className="text-[10px] text-[var(--text-muted)]">{formatarTempoRelativo(leadSelecionado.ultimaAtividade)}</p>
                  </div>
                </button>
                <button onClick={fechar} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                  <X size={16} />
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
                {flowNome && <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{flowNome} · últimos 15 leads</p>}
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
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        selecionado
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
