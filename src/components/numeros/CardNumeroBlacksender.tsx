'use client'

// Card de número Black Sender pro grid "Números Em Atividade" da home — mesmo formato visual do
// card de bot SendPulse ali (ver src/app/page.tsx), pra ficar tudo junto na mesma seção/grid em
// vez de uma seção separada. "Teste" de saúde aqui não é o bot-test do SendPulse (contact_id +
// ping/resposta) — é a última mensagem que o PRÓPRIO número enviou (outbound): se está mandando
// de verdade agora, tá vivo.

import { Pin } from 'lucide-react'
import { togglePinNumero } from '@/lib/store'
import type { BlacksenderCanal } from '@/types'

export interface CanalBlacksenderComAtividade extends BlacksenderCanal {
  ultimaMensagemEnviada: { conteudo: string | null; criadoEmOrigem: string } | null
}

const QUALITY_COR: Record<string, string> = {
  GREEN: 'text-green-500',
  YELLOW: 'text-amber-400',
  RED: 'text-red-500',
}

const QUALITY_LABEL: Record<string, string> = {
  GREEN: 'Alta',
  YELLOW: 'Média',
  RED: 'Baixa',
}

function tempoRelativo(iso: string): { texto: string; cor: string } {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return { texto: 'agora', cor: 'text-green-500' }
  if (diffMin < 60) return { texto: `há ${diffMin}min`, cor: 'text-green-500' }
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return { texto: `há ${diffH}h`, cor: 'text-amber-400' }
  const diffD = Math.floor(diffH / 24)
  return { texto: `há ${diffD}d`, cor: 'text-[var(--text-muted)]' }
}

export function CardNumeroBlacksender({ canal }: { canal: CanalBlacksenderComAtividade }) {
  const saudeOk = canal.healthStatus === 'available'
  const qualityCor = canal.qualityRating ? (QUALITY_COR[canal.qualityRating] ?? 'text-[var(--text-muted)]') : 'text-[var(--text-muted)]'
  const qualityLabel = canal.qualityRating ? (QUALITY_LABEL[canal.qualityRating] ?? canal.qualityRating) : '—'

  return (
    <div className="rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] p-4 space-y-3 hover:bg-[var(--glass-hover-bg)] hover:shadow-[var(--glass-hover-shadow)] transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${canal.status === 'active' ? 'bg-green-500' : 'bg-red-400'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">{canal.nome || 'Sem nome'}</span>
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]">
                Black Sender
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono truncate">{canal.telefone || '—'}</div>
          </div>
        </div>
        <button
          onClick={() => togglePinNumero(canal.id)}
          className="shrink-0 p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
          title="Desafixar"
        >
          <Pin size={14} className="text-amber-400" />
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-muted)]">qualidade:</span>
          <span className={`font-semibold ${qualityCor}`}>{qualityLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)]">status:</span>
          <span className="text-[var(--text-primary)] font-semibold">{canal.metaPhoneStatus || '—'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/50">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${saudeOk ? 'text-green-500' : 'text-red-500'}`}>
          <span className={`inline-block w-2 h-2 rounded-full ${saudeOk ? 'bg-green-500' : 'bg-red-500'}`} />
          {saudeOk ? 'Disponível' : (canal.healthReason || 'Indisponível')}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span>última msg:</span>
          {canal.ultimaMensagemEnviada ? (
            (() => {
              const { texto, cor } = tempoRelativo(canal.ultimaMensagemEnviada.criadoEmOrigem)
              return <span className={`font-medium ${cor}`} title={canal.ultimaMensagemEnviada.conteudo ?? undefined}>{texto}</span>
            })()
          ) : (
            <span className="text-[var(--text-muted)]/50">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
