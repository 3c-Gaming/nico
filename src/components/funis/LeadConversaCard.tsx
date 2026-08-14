'use client'

// Cartão de lead com a jornada dentro de um fluxo — usado tanto no painel lateral (PainelConversasFluxo,
// tela de Funis) quanto na apresentação pública de funil único (funis/apresentar-funil).

import { useState } from 'react'
import { ChevronDown, ChevronUp, Bot, User, MousePointerClick, Link2, Image as ImageIcon, FileText, Volume2, Video, Tag as TagIcon, CheckCircle2 } from 'lucide-react'

export interface MensagemFluxo {
  id: string
  direcao: 'entrada' | 'saida'
  criadoEm: string
  tipo: 'texto' | 'imagem' | 'documento' | 'audio' | 'video' | 'botao_clicado' | 'lista_selecionada' | 'link_enviado' | 'outro'
  texto?: string
  botaoTitulo?: string
  linkUrl?: string
  linkTexto?: string
  imagemUrl?: string
  botoesOferecidos?: string[]
  chainId?: string
  blockId?: string
}

export interface LeadComConversa {
  contactId: string
  nome: string
  telefone: string
  ultimaAtividade: string
  tags: string[]
  variaveis: Record<string, unknown>
  mensagens: MensagemFluxo[]
  tagCliqueLink: string | null
}

export function formatarTempoRelativo(iso: string): string {
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
      return <MousePointerClick size={13} className={`${cls} text-[var(--success)]`} />
    case 'link_enviado':
      return <Link2 size={13} className={`${cls} text-[var(--d1)]`} />
    case 'imagem':
      return <ImageIcon size={13} className={`${cls} text-[var(--text-muted)]`} />
    case 'documento':
      return <FileText size={13} className={`${cls} text-[var(--text-muted)]`} />
    case 'audio':
      return <Volume2 size={13} className={`${cls} text-[var(--text-muted)]`} />
    case 'video':
      return <Video size={13} className={`${cls} text-[var(--text-muted)]`} />
    default:
      return null
  }
}

function MensagemLinha({ msg, cliqueConfirmado }: { msg: MensagemFluxo; cliqueConfirmado?: boolean }) {
  const deEntrada = msg.direcao === 'entrada'
  return (
    <div className="flex gap-2">
      <div className="flex flex-col items-center pt-0.5 shrink-0 w-8">
        {deEntrada ? <User size={13} className="text-[var(--d3)]" /> : <Bot size={13} className="text-[var(--text-muted)]" />}
        <span className="text-[10px] text-[var(--text-muted)]/70 mt-0.5">{formatarHora(msg.criadoEm)}</span>
      </div>
      <div className={`flex-1 min-w-0 rounded px-2.5 py-2 text-[13px] leading-snug ${deEntrada ? 'bg-[var(--d3)]/10 border border-[var(--d3)]/20' : 'bg-[var(--bg-elevated)] border border-[var(--border)]'
        }`}>
        {msg.tipo === 'botao_clicado' || msg.tipo === 'lista_selecionada' ? (
          <div className="flex items-center gap-1.5 font-medium text-[var(--success)]">
            <IconeMensagem tipo={msg.tipo} />
            clicou: {msg.botaoTitulo}
          </div>
        ) : msg.tipo === 'link_enviado' ? (
          <div className="space-y-1">
            {msg.texto && <p className="text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-3">{msg.texto}</p>}
            <div className="flex justify-center items-center gap-2 flex-wrap border bg-gray-950ß shadow-sm rounded bg-[var(--bg-elevated)] border-[var(--border)] px-2 py-2">
              <a
                href={msg.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-medium text-[var(--success)] hover:underline"
              >
                <IconeMensagem tipo={msg.tipo} />
                {msg.linkTexto || 'Link'}
              </a>

            </div>
            {cliqueConfirmado && (
              <span className="flex items-center gap-1 text-[13px] font-medium text-[var(--success)]">
                <CheckCircle2 size={11} />
                Visto e Clicado
              </span>
            )}
          </div>
        ) : msg.tipo === 'imagem' && msg.imagemUrl ? (
          <div className="space-y-1">
            <a href={msg.imagemUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (S3 da SendPulse), sem domínio fixo pra configurar no next/image */}
              <img
                src={msg.imagemUrl}
                alt={msg.texto || 'Imagem enviada'}
                className="max-w-[220px] max-h-[220px] rounded border border-[var(--border)] object-cover"
                loading="lazy"
              />
            </a>
            {msg.texto && <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{msg.texto}</p>}
          </div>
        ) : msg.tipo === 'imagem' || msg.tipo === 'documento' || msg.tipo === 'audio' || msg.tipo === 'video' ? (
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] italic">
            <IconeMensagem tipo={msg.tipo} />
            {msg.tipo === 'imagem' ? 'imagem' : msg.tipo === 'documento' ? 'documento' : msg.tipo === 'audio' ? 'áudio' : 'vídeo'}
            {msg.texto && <span className="not-italic text-[var(--text-secondary)]">— {msg.texto}</span>}
          </div>
        ) : (
          <div>
            <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{msg.texto || '—'}</p>
            {msg.botoesOferecidos && msg.botoesOferecidos.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-1">
                {msg.botoesOferecidos.map((label, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center gap-1.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] font-medium text-[var(--d1)]"
                  >
                    <MousePointerClick size={12} className="text-[var(--text-muted)]" />
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Bloco de detalhe (tags + variáveis + jornada) de um lead — sem o cabeçalho/accordion, pra poder
 * ser usado tanto dentro do LeadConversaCard (apresentação pública) quanto num painel próprio
 * (sidebar de detalhe do PainelConversasFluxo). */
export function LeadConversaDetalhe({ lead }: { lead: LeadComConversa }) {
  const variaveisEntries = Object.entries(lead.variaveis).filter(([, v]) => v != null && v !== '')

  return (
    <div className="space-y-3">
      {lead.tags.length > 0 && (
        <div className="flex items-start gap-1.5">
          <TagIcon size={12} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
          <div className="flex flex-wrap gap-1">
            {lead.tags.map((t) => {
              const ehTagDeClique = t === lead.tagCliqueLink
              return (
                <span
                  key={t}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${ehTagDeClique
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
          <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Variáveis</p>
          <div className="rounded bg-[var(--bg-elevated)] border border-[var(--border)] p-2 space-y-0.5">
            {variaveisEntries.map(([k, v]) => (
              <div key={k} className="flex gap-1.5 text-[11px]">
                <span className="font-mono text-[var(--text-muted)] shrink-0">{k}:</span>
                <span className="text-[var(--text-secondary)] truncate" title={String(v)}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Jornada</p>
        {lead.mensagens.map((msg) => (
          <MensagemLinha key={msg.id} msg={msg} cliqueConfirmado={msg.tipo === 'link_enviado' && !!lead.tagCliqueLink} />
        ))}
      </div>
    </div>
  )
}

export function LeadConversaCard({ lead, abertoPorPadrao }: { lead: LeadComConversa; abertoPorPadrao?: boolean }) {
  const [expandido, setExpandido] = useState(abertoPorPadrao ?? false)
  const cliques = lead.mensagens.filter((m) => m.tipo === 'botao_clicado' || m.tipo === 'lista_selecionada').length
  const links = lead.mensagens.filter((m) => m.tipo === 'link_enviado').length

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
        <div className="px-3 pb-3 border-t border-[var(--border)] pt-3">
          <LeadConversaDetalhe lead={lead} />
        </div>
      )}
    </div>
  )
}
