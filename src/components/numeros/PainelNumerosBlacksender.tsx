'use client'

// Seção enxuta pros números (canais WhatsApp) da Black Sender, ao lado dos bots SendPulse na
// tela de Números — mesmo princípio do painel de Funis Black Sender: self-contained, não tenta
// encaixar no pipeline de NumeroSendpulse/monitoramento (bot-test, aquecimento) que é 100%
// SendPulse. Só leitura — o número em si é gerenciado no painel da própria Black Sender.

import { useState, useEffect } from 'react'
import { Layers } from 'lucide-react'
import type { BlacksenderCanal } from '@/types'

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

function StatusSaude({ canal }: { canal: BlacksenderCanal }) {
  const ok = canal.healthStatus === 'available'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${ok ? 'text-green-500' : 'text-red-500'}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {ok ? 'Disponível' : (canal.healthReason || 'Indisponível')}
    </span>
  )
}

function QualityBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span className="text-xs text-[var(--text-muted)]/40">—</span>
  const cor = QUALITY_COR[rating] ?? 'text-[var(--text-muted)]'
  const label = QUALITY_LABEL[rating] ?? rating
  return <span className={`text-xs font-medium ${cor}`}>{label}</span>
}

export function PainelNumerosBlacksender() {
  const [canais, setCanais] = useState<BlacksenderCanal[] | null>(null)

  useEffect(() => {
    fetch('/api/blacksender/canais')
      .then((r) => (r.ok ? r.json() : { canais: [] }))
      .then((d) => setCanais(d.canais ?? []))
      .catch(() => setCanais([]))
  }, [])

  if (canais !== null && canais.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Layers size={16} className="text-[var(--d1)]" />
          Números — Black Sender
          {canais && <span className="text-xs font-normal text-[var(--text-muted)]">{canais.length}</span>}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--glass-border)]">
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Nome / Número</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Provedor</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Saúde</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Qualidade da conta no WhatsApp Business — cai se tiver muito bloqueio/denúncia">Qualidade</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Status Meta</th>
            </tr>
          </thead>
          <tbody>
            {canais === null ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-[var(--text-muted)]">Carregando...</td>
              </tr>
            ) : (
              canais.map((c) => (
                <tr key={c.id} className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${c.status === 'active' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">{c.nome || '—'}</div>
                        <div className="text-xs text-[var(--text-muted)] font-mono">{c.telefone || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{c.provedor || '—'}</td>
                  <td className="py-3 px-3"><StatusSaude canal={c} /></td>
                  <td className="py-3 px-3"><QualityBadge rating={c.qualityRating} /></td>
                  <td className="py-3 px-3 text-xs text-[var(--text-muted)]">{c.metaPhoneStatus || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
