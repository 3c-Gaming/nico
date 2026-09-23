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
  /** Título em destaque acima do texto (ex: título do card de um RCS) — opcional, sem título a
   * mensagem só mostra o texto normal. */
  titulo?: string
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

// border-current/bg transparente: herda a cor de texto que a bolha já escolheu (verde do
// WhatsApp, azul do Telegram/RCS, branco...) em vez de uma cor fixa que só funciona num fundo —
// era isso que deixava o botão ilegível (pill escuro em cima de bolha clara). Funciona em
// qualquer tema sem precisar de caso especial por canal.
function BotoesOferecidos({ botoes }: { botoes?: string[] }) {
  if (!botoes || botoes.length === 0) return null
  return (
    <div className="mt-2 pt-2 border-t border-current/15 space-y-1">
      {botoes.map((label, i) => (
        <div
          key={i}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-current/25 px-2.5 py-1.5 text-[12px] font-semibold"
        >
          <MousePointerClick size={12} />
          {label}
        </div>
      ))}
    </div>
  )
}

/** Canal de origem da conversa — define a paleta da bolha (cores fixas de propósito, do jeito
 * que cada app realmente parece, não do tema claro/escuro do Nico). Sem canal reconhecido, cai
 * num neutro que já era o visual antigo. */
export type TemaConversa = 'whatsapp' | 'telegram' | 'rcs'

const TEMA_PADRAO = {
  saidaBg: 'bg-[var(--bg-elevated)]', saidaTexto: 'text-[var(--text-primary)]', saidaBorda: 'border border-[var(--border)]',
  entradaBg: 'bg-[var(--d3)]/10', entradaTexto: 'text-[var(--text-primary)]', entradaBorda: 'border border-[var(--d3)]/20',
}

const TEMA_POR_CANAL: Record<TemaConversa, typeof TEMA_PADRAO> = {
  whatsapp: {
    saidaBg: 'bg-[#d9fdd3]', saidaTexto: 'text-[#111b21]', saidaBorda: '',
    entradaBg: 'bg-white', entradaTexto: 'text-[#111b21]', entradaBorda: 'border border-black/5',
  },
  telegram: {
    saidaBg: 'bg-[#e3f3fd]', saidaTexto: 'text-[#0f1a24]', saidaBorda: '',
    entradaBg: 'bg-white', entradaTexto: 'text-[#0f1a24]', entradaBorda: 'border border-black/5',
  },
  rcs: {
    saidaBg: 'bg-[#0b84ff]', saidaTexto: 'text-white', saidaBorda: '',
    entradaBg: 'bg-[#e9e9eb]', entradaTexto: 'text-[#111]', entradaBorda: '',
  },
}

/** Avatar circular de 32px — foto de verdade quando tem (ex: fotoUrl do canal WhatsApp do Black
 * Sender), senão um ícone genérico (Bot pro remetente, User pro lead — nunca busca foto do lead,
 * só existe avatar de bot mesmo). */
function Avatar({ fotoUrl, Icone }: { fotoUrl?: string | null; Icone: typeof Bot }) {
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar de canal, URL externa variável por provedor
      <img src={fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-[var(--border)]" />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center shrink-0">
      <Icone size={16} className="text-[var(--text-muted)]" />
    </div>
  )
}

function MensagemLinha({
  msg, cliqueConfirmado, remetenteNome, remetenteFotoUrl, leadNome, tema,
}: {
  msg: MensagemFluxo
  cliqueConfirmado?: boolean
  /** Nome/foto de quem manda as mensagens "saida" — bot do WhatsApp, do Telegram, agente de RCS
   * etc. Sem foto (a maioria dos canais não expõe isso pra gente), cai no ícone genérico. */
  remetenteNome?: string
  remetenteFotoUrl?: string | null
  leadNome?: string
  tema: typeof TEMA_PADRAO
}) {
  const deEntrada = msg.direcao === 'entrada'
  const nome = deEntrada ? (leadNome || 'Lead') : (remetenteNome || 'Bot')
  const ehCard = msg.tipo === 'imagem' && !!msg.imagemUrl
  // Card (imagem) usa a mesma cor de bolha das outras mensagens agora — só a imagem em si sangra
  // até a borda (cancela o padding com margem negativa), texto e botões ficam dentro do padding
  // normal, herdando a cor do tema.
  const corBolha = deEntrada
    ? `${tema.entradaBg} ${tema.entradaTexto} ${tema.entradaBorda}`
    : `${tema.saidaBg} ${tema.saidaTexto} ${tema.saidaBorda}`

  return (
    // Ancorada na direita quando é a gente que mandou, na esquerda quando é o lead — igual
    // qualquer app de chat de verdade.
    <div className={`flex ${deEntrada ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[82%] min-w-0 flex flex-col gap-1 ${deEntrada ? 'items-start' : 'items-end'}`}>
        <div className={`flex items-center gap-2 px-1 ${deEntrada ? '' : 'flex-row-reverse'}`}>
          <Avatar fotoUrl={deEntrada ? null : remetenteFotoUrl} Icone={deEntrada ? User : Bot} />
          <span className="text-[13px] font-semibold text-[var(--text-secondary)] truncate">{nome}</span>
          <span className="text-[11px] text-[var(--text-muted)]">{formatarHora(msg.criadoEm)}</span>
        </div>
        <div
          className={`min-w-0 rounded-2xl overflow-hidden px-3 py-2 text-[13px] leading-snug ${deEntrada ? 'rounded-bl-md' : 'rounded-br-md'
            } ${corBolha}`}
        >
          {msg.tipo === 'botao_clicado' || msg.tipo === 'lista_selecionada' ? (
            <div className="flex items-center gap-1.5 font-medium">
              <MousePointerClick size={13} className="shrink-0 text-[var(--success)]" />
              clicou: {msg.botaoTitulo}
            </div>
          ) : msg.tipo === 'link_enviado' ? (
            <div className="space-y-1">
              {msg.texto && <p className="whitespace-pre-wrap line-clamp-3">{msg.texto}</p>}
              <div className="flex justify-center items-center gap-2 flex-wrap rounded bg-black/5 px-2 py-2">
                <a
                  href={msg.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  <Link2 size={13} className="shrink-0" />
                  {msg.linkTexto || 'Link'}
                </a>
              </div>
              {cliqueConfirmado && (
                <span className="flex items-center gap-1 text-[13px] font-medium">
                  <CheckCircle2 size={11} />
                  Visto e Clicado
                </span>
              )}
            </div>
          ) : ehCard ? (
            // Card com imagem: mesma cor de bolha do tema (herda de corBolha) — só a imagem sangra
            // até a borda, cancelando o padding do wrapper com margem negativa. Botões herdam a
            // cor de texto atual (border-current), então funcionam em qualquer tema sem contraste
            // ruim — era um pill escuro fixo em cima de bolha clara antes.
            <div className="-mx-3 -mt-2">
              <a href={msg.imagemUrl} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (S3 da SendPulse), sem domínio fixo pra configurar no next/image */}
                <img
                  src={msg.imagemUrl}
                  alt={msg.titulo || msg.texto || 'Imagem enviada'}
                  className="w-full max-h-[220px] object-cover"
                  loading="lazy"
                />
              </a>
              {(msg.titulo || msg.texto) && (
                <div className="px-3 pt-2 pb-1.5 space-y-0.5">
                  {msg.titulo && <p className="font-semibold whitespace-pre-wrap">{msg.titulo}</p>}
                  {msg.texto && <p className="opacity-80 whitespace-pre-wrap">{msg.texto}</p>}
                </div>
              )}
              {msg.botoesOferecidos && msg.botoesOferecidos.length > 0 && (
                <div className="border-t border-current/15 divide-y divide-current/15">
                  {msg.botoesOferecidos.map((label, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold"
                    >
                      <MousePointerClick size={12} />
                      {label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : msg.tipo === 'imagem' || msg.tipo === 'documento' || msg.tipo === 'audio' || msg.tipo === 'video' ? (
            <div className="flex items-center gap-1.5 italic">
              <IconeMensagem tipo={msg.tipo} />
              {msg.tipo === 'imagem' ? 'imagem' : msg.tipo === 'documento' ? 'documento' : msg.tipo === 'audio' ? 'áudio' : 'vídeo'}
              {msg.texto && <span className="not-italic">— {msg.texto}</span>}
            </div>
          ) : (
            <div>
              {msg.titulo && <p className="font-semibold whitespace-pre-wrap">{msg.titulo}</p>}
              {(msg.texto || !msg.titulo) && <p className="whitespace-pre-wrap">{msg.texto || '—'}</p>}
              <BotoesOferecidos botoes={msg.botoesOferecidos} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Bloco de detalhe (tags + variáveis + jornada) de um lead — sem o cabeçalho/accordion, pra poder
 * ser usado tanto dentro do LeadConversaCard (apresentação pública) quanto num painel próprio
 * (sidebar de detalhe do PainelConversasFluxo). */
export function LeadConversaDetalhe({
  lead, remetenteNome, remetenteFotoUrl, canal,
}: {
  lead: LeadComConversa
  /** Nome/foto do bot que mandou as mensagens "saida" dessa conversa (ver MensagemLinha). */
  remetenteNome?: string
  remetenteFotoUrl?: string | null
  /** WhatsApp/Telegram/RCS — dá a cor da bolha (ver TEMA_POR_CANAL). Sem canal reconhecido, cai
   * no visual neutro antigo. */
  canal?: TemaConversa
}) {
  const variaveisEntries = Object.entries(lead.variaveis).filter(([, v]) => v != null && v !== '')
  const tema = canal ? TEMA_POR_CANAL[canal] : TEMA_PADRAO

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
          <MensagemLinha
            key={msg.id}
            msg={msg}
            cliqueConfirmado={msg.tipo === 'link_enviado' && !!lead.tagCliqueLink}
            remetenteNome={remetenteNome}
            remetenteFotoUrl={remetenteFotoUrl}
            leadNome={lead.nome}
            tema={tema}
          />
        ))}
      </div>
    </div>
  )
}

export function LeadConversaCard({
  lead, abertoPorPadrao, remetenteNome, remetenteFotoUrl, canal,
}: {
  lead: LeadComConversa
  abertoPorPadrao?: boolean
  remetenteNome?: string
  remetenteFotoUrl?: string | null
  canal?: TemaConversa
}) {
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
          <LeadConversaDetalhe lead={lead} remetenteNome={remetenteNome} remetenteFotoUrl={remetenteFotoUrl} canal={canal} />
        </div>
      )}
    </div>
  )
}
