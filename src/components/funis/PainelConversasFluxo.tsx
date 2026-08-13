'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronDown, ChevronUp, Bot, User, MousePointerClick, Link2, Image as ImageIcon, FileText, Volume2, Video, Tag as TagIcon, CheckCircle2 } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'

interface MensagemFluxo {
  id: string
  direcao: 'entrada' | 'saida'
  criadoEm: string
  tipo: 'texto' | 'imagem' | 'documento' | 'audio' | 'video' | 'botao_clicado' | 'lista_selecionada' | 'link_enviado' | 'outro'
  texto?: string
  botaoTitulo?: string
  linkUrl?: string
  linkTexto?: string
  chainId?: string
  blockId?: string
}

interface LeadComConversa {
  contactId: string
  nome: string
  telefone: string
  ultimaAtividade: string
  tags: string[]
  variaveis: Record<string, unknown>
  mensagens: MensagemFluxo[]
  tagCliqueLink: string | null
}

interface PainelConversasFluxoProps {
  aberto: boolean
  onClose: () => void
  botId: string | null
  flowId: string | null
  tag: string | null
  flowNome: string | null
}

function formatarTempoRelativo(iso: string): string {
  const agora = Date.now()
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return iso
  const diffMs = agora - ts
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`
  if (diffH < 24) return `há ${diffH}h`
  if (diffD < 7) return `há ${diffD}d`
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatarHora(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function IconeMensagem({ tipo }: { tipo: MensagemFluxo['tipo'] }) {
  const cls = 'shrink-0'
  switch (tipo) {
    case 'botao_clicado':
    case 'lista_selecionada':
      return <MousePointerClick size={12} className={`${cls} text-[var(--success)]`} />
    case 'link_enviado':
      return <Link2 size={12} className={`${cls} text-[var(--d1)]`} />
    case 'imagem':
      return <ImageIcon size={12} className={`${cls} text-[var(--text-muted)]`} />
    case 'documento':
      return <FileText size={12} className={`${cls} text-[var(--text-muted)]`} />
    case 'audio':
      return <Volume2 size={12} className={`${cls} text-[var(--text-muted)]`} />
    case 'video':
      return <Video size={12} className={`${cls} text-[var(--text-muted)]`} />
    default:
      return null
  }
}

function MensagemLinha({ msg }: { msg: MensagemFluxo }) {
  const deEntrada = msg.direcao === 'entrada'
  return (
    <div className="flex gap-2">
      <div className="flex flex-col items-center pt-0.5 shrink-0 w-7">
        {deEntrada ? <User size={11} className="text-[var(--d3)]" /> : <Bot size={11} className="text-[var(--text-muted)]" />}
        <span className="text-[9px] text-[var(--text-muted)]/70 mt-0.5">{formatarHora(msg.criadoEm)}</span>
      </div>
      <div className={`flex-1 min-w-0 rounded px-2 py-1.5 text-[11px] leading-snug ${
        deEntrada ? 'bg-[var(--d3)]/10 border border-[var(--d3)]/20' : 'bg-[var(--bg-elevated)] border border-[var(--border)]'
      }`}>
        {msg.tipo === 'botao_clicado' || msg.tipo === 'lista_selecionada' ? (
          <div className="flex items-center gap-1.5 font-medium text-[var(--success)]">
            <IconeMensagem tipo={msg.tipo} />
            clicou: {msg.botaoTitulo}
          </div>
        ) : msg.tipo === 'link_enviado' ? (
          <div className="space-y-1">
            {msg.texto && <p className="text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-3">{msg.texto}</p>}
            <a
              href={msg.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-medium text-[var(--d1)] hover:underline"
            >
              <IconeMensagem tipo={msg.tipo} />
              {msg.linkTexto || 'Link'}
            </a>
          </div>
        ) : msg.tipo === 'imagem' || msg.tipo === 'documento' || msg.tipo === 'audio' || msg.tipo === 'video' ? (
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] italic">
            <IconeMensagem tipo={msg.tipo} />
            {msg.tipo === 'imagem' ? 'imagem' : msg.tipo === 'documento' ? 'documento' : msg.tipo === 'audio' ? 'áudio' : 'vídeo'}
            {msg.texto && <span className="not-italic text-[var(--text-secondary)]">— {msg.texto}</span>}
          </div>
        ) : (
          <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{msg.texto || '—'}</p>
        )}
      </div>
    </div>
  )
}

function LeadCard({ lead }: { lead: LeadComConversa }) {
  const [expandido, setExpandido] = useState(false)
  const cliques = lead.mensagens.filter((m) => m.tipo === 'botao_clicado' || m.tipo === 'lista_selecionada').length
  const links = lead.mensagens.filter((m) => m.tipo === 'link_enviado').length
  const variaveisEntries = Object.entries(lead.variaveis).filter(([, v]) => v != null && v !== '')

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      <button
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg-elevated)] transition-colors"
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
        {expandido ? <ChevronUp size={14} className="text-[var(--text-muted)] shrink-0" /> : <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />}
      </button>

      {expandido && (
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--border)] pt-3">
          {lead.tags.length > 0 && (
            <div className="flex items-start gap-1.5">
              <TagIcon size={11} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((t) => {
                  const ehTagDeClique = t === lead.tagCliqueLink
                  return (
                    <span
                      key={t}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                        ehTagDeClique
                          ? 'bg-[var(--success)]/15 border-[var(--success)]/40 text-[var(--success)] font-semibold'
                          : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {t}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {variaveisEntries.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Variáveis</p>
              <div className="rounded bg-[var(--bg-elevated)] border border-[var(--border)] p-2 space-y-0.5">
                {variaveisEntries.map(([k, v]) => (
                  <div key={k} className="flex gap-1.5 text-[10px]">
                    <span className="font-mono text-[var(--text-muted)] shrink-0">{k}:</span>
                    <span className="text-[var(--text-secondary)] truncate" title={String(v)}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Jornada</p>
            {lead.mensagens.map((msg) => (
              <MensagemLinha key={msg.id} msg={msg} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function PainelConversasFluxo({ aberto, onClose, botId, flowId, tag, flowNome }: PainelConversasFluxoProps) {
  const [leads, setLeads] = useState<LeadComConversa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto || !botId || !flowId || !tag) return
    const params = new URLSearchParams({ botId, flowId, tag, quantidade: '5' })
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
      if (e.key === 'Escape') onClose()
    }
    if (aberto) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [aberto, onClose])

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
            onClick={onClose}
          />
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
                {flowNome && <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{flowNome} · últimos 5 leads</p>}
              </div>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
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
                leads.map((lead) => <LeadCard key={lead.contactId} lead={lead} />)
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
