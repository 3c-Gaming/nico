'use client'

// Seção enxuta pros números (canais WhatsApp) da Black Sender, ao lado dos bots SendPulse na
// tela de Números — mesmo princípio do painel de Funis Black Sender: self-contained, não tenta
// encaixar no pipeline de NumeroSendpulse/monitoramento (bot-test, aquecimento) que é 100%
// SendPulse. "Teste" de saúde aqui não precisa do esquema de bot-test (mandar ping e esperar
// resposta) — já temos a última mensagem que o PRÓPRIO número mandou (outbound), então "tá vivo"
// = mandou mensagem recentemente. Editar o número em si continua sendo no painel da Black Sender.
//
// Fixar/desafixar mostra o número no grid "Números Em Atividade" da home, junto com os bots
// SendPulse (ver CardNumeroBlacksender) — não numa seção própria aqui.

import { useState, useEffect, useSyncExternalStore } from 'react'
import { Layers, Pin } from 'lucide-react'
import { getState, togglePinNumero } from '@/lib/store'
import type { BlacksenderCanal } from '@/types'

// getState().pinnedNumeros é mutado in-place (push/splice, ver togglePinNumero) — a referência do
// array nunca muda, só o conteúdo, então o snapshot do useSyncExternalStore precisa ser um valor
// primitivo (aqui, a string junta) pra React notar a mudança e atualizar a cor do ícone do pin
// assim que clica, sem precisar de reload.
function usePinnedNumerosChave(): string {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('nico:state-changed', cb); return () => window.removeEventListener('nico:state-changed', cb) },
    () => getState().pinnedNumeros.join(','),
    () => '',
  )
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

interface CanalComAtividade extends BlacksenderCanal {
  ultimaMensagemEnviada: { conteudo: string | null; criadoEmOrigem: string } | null
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

function UltimaMensagemEnviada({ dado }: { dado: CanalComAtividade['ultimaMensagemEnviada'] }) {
  if (!dado) return <span className="text-xs text-[var(--text-muted)]/40">Nunca enviou</span>
  const { texto, cor } = tempoRelativo(dado.criadoEmOrigem)
  return (
    <span className={`text-xs font-medium ${cor}`} title={dado.conteudo ?? undefined}>
      {texto}
    </span>
  )
}

export function PainelNumerosBlacksender() {
  const [canais, setCanais] = useState<CanalComAtividade[] | null>(null)

  useEffect(() => {
    fetch('/api/blacksender/canais')
      .then((r) => (r.ok ? r.json() : { canais: [] }))
      .then((d) => setCanais(d.canais ?? []))
      .catch(() => setCanais([]))
  }, [])

  usePinnedNumerosChave()
  const pinnedNumeros = getState().pinnedNumeros

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
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Última mensagem que o próprio número enviou — se está mandando, tá vivo">Última msg enviada</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]"></th>
            </tr>
          </thead>
          <tbody>
            {canais === null ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-[var(--text-muted)]">Carregando...</td>
              </tr>
            ) : (
              canais.map((c) => {
                const pinado = pinnedNumeros.includes(c.id)
                return (
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
                    <td className="py-3 px-3"><UltimaMensagemEnviada dado={c.ultimaMensagemEnviada} /></td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => togglePinNumero(c.id)}
                        className="p-1 rounded transition-colors"
                        style={{ color: pinado ? 'var(--d1)' : 'var(--text-muted)' }}
                        title={pinado ? 'Desafixar da Home' : 'Fixar na Home'}
                      >
                        <Pin size={13} fill={pinado ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
