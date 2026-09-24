'use client'

// Seção dos números (canais WhatsApp) da Black Sender na tela de Números. O relatório usa
// flow_runs/leads persistidos no banco, então um número que cai do bridge continua aparecendo
// com o último estado conhecido e o histórico de aquecimento.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { BarChart3, Layers, Pin } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { getState, togglePinNumero } from '@/lib/store'
import type { BlacksenderCanal, BlacksenderNumeroResumo } from '@/types'

const INTERVALO_ATUALIZACAO_MS = 15_000
const LIMITE_SEM_SINAL_MS = 5 * 60_000

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

interface CanalComAtividade extends BlacksenderCanal, BlacksenderNumeroResumo {
  ultimaMensagemEnviada: { conteudo: string | null; criadoEmOrigem: string } | null
}

function dataValida(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? null : data
}

function formatarDataHora(iso: string | null | undefined): string {
  const data = dataValida(iso)
  if (!data) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(data)
}

function formatarDataCurta(iso: string): string {
  // Datas YYYY-MM-DD não têm horário; usar meio-dia evita que o UTC apareça como dia anterior.
  const data = dataValida(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)
  if (!data) return iso
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(data)
}

function tempoRelativo(iso: string | null | undefined): { texto: string; cor: string } {
  const data = dataValida(iso)
  if (!data) return { texto: '—', cor: 'text-[var(--text-muted)]' }
  const diffMs = Date.now() - data.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return { texto: 'agora', cor: 'text-green-500' }
  if (diffMin < 60) return { texto: `há ${diffMin}min`, cor: 'text-green-500' }
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return { texto: `há ${diffH}h`, cor: 'text-amber-400' }
  const diffD = Math.floor(diffH / 24)
  return { texto: `há ${diffD}d`, cor: 'text-[var(--text-muted)]' }
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

function StatusNumero({ canal, agoraMs }: { canal: CanalComAtividade; agoraMs: number | null }) {
  const ultimoVisto = dataValida(canal.ultimoVistoEm ?? canal.recebidoEm)
  const semSinal = !!ultimoVisto && agoraMs !== null && agoraMs - ultimoVisto.getTime() > LIMITE_SEM_SINAL_MS
  const ativo = canal.status === 'active' && canal.healthStatus === 'available' && !semSinal
  const inativo = canal.status === 'inactive' || canal.healthStatus === 'blocked' || canal.healthStatus === 'unavailable'

  if (ativo) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-500" title={formatarDataHora(canal.ultimoVistoEm ?? canal.recebidoEm)}>
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        Ativo
      </span>
    )
  }
  if (semSinal) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400" title={`Sem novo heartbeat desde ${formatarDataHora(canal.ultimoVistoEm ?? canal.recebidoEm)}`}>
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
        Sem sinal
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500" title={canal.healthReason ?? formatarDataHora(canal.ultimoVistoEm ?? canal.recebidoEm)}>
      <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
      {inativo ? 'Inativo' : 'Desconhecido'}
    </span>
  )
}

function LeadsRecentes({ dados }: { dados: Array<{ data: string; total: number }> }) {
  if (dados.length === 0) return <span className="text-xs text-[var(--text-muted)]/50">—</span>
  const recentes = dados.slice(-7)
  return (
    <span
      className="font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap"
      title={dados.map((d) => `${formatarDataCurta(d.data)}: ${d.total}`).join(' · ')}
    >
      {recentes.map((d) => `${formatarDataCurta(d.data)}: ${d.total}`).join(' · ')}
    </span>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{value}</div>
    </div>
  )
}

function DetalhesNumero({ canal, agoraMs, onClose }: { canal: CanalComAtividade; agoraMs: number | null; onClose: () => void }) {
  const ultimoLead = tempoRelativo(canal.ultimoLeadEm)
  const ultimaMensagem = canal.ultimaMensagemEnviada
    ? tempoRelativo(canal.ultimaMensagemEnviada.criadoEmOrigem).texto
    : 'Nunca enviou'
  const diasReverso = canal.leadsPorDia.slice().reverse()

  return (
    <Modal open onClose={onClose} title={`Aquecimento · ${canal.nome || canal.telefone || canal.id}`} width="760px">
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <StatusNumero canal={canal} agoraMs={agoraMs} />
          <span className="text-[var(--text-muted)]">·</span>
          <span className="font-mono">{canal.telefone || 'sem número'}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <InfoCard label="Adicionado ao bridge" value={formatarDataHora(canal.primeiroVistoEm ?? canal.criadoEmOrigem)} />
          <InfoCard label="Primeiro lead" value={formatarDataHora(canal.primeiroLeadEm)} />
          <InfoCard label="Leads hoje" value={String(canal.leadsHoje)} />
          <InfoCard label="Funis observados" value={String(canal.funis)} />
          <InfoCard label="Último lead" value={ultimoLead.texto} />
          <InfoCard label="Última msg enviada" value={ultimaMensagem} />
          <InfoCard label="Último sinal do bridge" value={formatarDataHora(canal.ultimoVistoEm ?? canal.recebidoEm)} />
          <InfoCard label="Provedor" value={canal.provedor || '—'} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Leads por dia</h3>
            <span className="text-[11px] text-[var(--text-muted)]">{canal.leadsPorDia.length} dia(s) registrado(s)</span>
          </div>
          <p className="mb-2 text-[11px] text-[var(--text-muted)]">
            Lead = contato distinto que entrou em um flow run; reentrada no mesmo dia conta uma vez.
          </p>
          {canal.leadsPorDia.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-muted)]">
              Nenhum lead registrado para este número.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left px-3 py-2 text-[11px] font-medium text-[var(--text-muted)]">Data</th>
                    <th className="text-right px-3 py-2 text-[11px] font-medium text-[var(--text-muted)]">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {diasReverso.map((linha) => (
                    <tr key={linha.data} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">{formatarDataCurta(linha.data)}</td>
                      <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-[var(--text-primary)]">{linha.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3 text-xs">
          <div className="flex items-center justify-between gap-2"><span className="text-[var(--text-muted)]">Saúde</span><StatusSaude canal={canal} /></div>
          <div className="flex items-center justify-between gap-2"><span className="text-[var(--text-muted)]">Qualidade</span><QualityBadge rating={canal.qualityRating} /></div>
        </div>
      </div>
    </Modal>
  )
}

export function PainelNumerosBlacksender() {
  const [canais, setCanais] = useState<CanalComAtividade[] | null>(null)
  const [canalSelecionadoId, setCanalSelecionadoId] = useState<string | null>(null)
  const [agoraMs, setAgoraMs] = useState<number | null>(null)
  const [erroAtualizacao, setErroAtualizacao] = useState(false)

  useEffect(() => {
    let ativo = true
    let buscando = false
    const carregar = () => {
      if (buscando) return
      buscando = true
      setAgoraMs(Date.now())
      fetch('/api/blacksender/canais')
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then((d) => {
          if (!ativo) return
          setErroAtualizacao(false)
          setCanais(d.canais ?? [])
        })
        .catch(() => {
          // Uma falha temporória não pode apagar o histórico que já está em tela.
          if (ativo) setErroAtualizacao(true)
        })
        .finally(() => { buscando = false })
    }
    void carregar()
    const intervalo = window.setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => {
      ativo = false
      window.clearInterval(intervalo)
    }
  }, [])

  usePinnedNumerosChave()
  const pinnedNumeros = getState().pinnedNumeros
  const canalSelecionado = canalSelecionadoId
    ? canais?.find((canal) => canal.id === canalSelecionadoId) ?? null
    : null

  if (canais !== null && canais.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Layers size={16} className="text-[var(--d1)]" />
          Números — Black Sender
          {canais && <span className="text-xs font-normal text-[var(--text-muted)]">{canais.length}</span>}
        </h2>
        {erroAtualizacao ? (
          <span className="text-[11px] text-red-400">Falha ao atualizar — mostrando o último histórico</span>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">Atualiza a cada 15s</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--glass-border)]">
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Nome / Número</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Primeira vez que o canal foi visto pelo bridge">Adicionado</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">1º lead</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Hoje</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Leads por dia</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Funis</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Último lead</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Qualidade</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]"></th>
            </tr>
          </thead>
          <tbody>
            {canais === null ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-xs text-[var(--text-muted)]">Carregando...</td>
              </tr>
            ) : (
              canais.map((c) => {
                const pinado = pinnedNumeros.includes(c.id)
                const ultimoLead = tempoRelativo(c.ultimoLeadEm)
                return (
                  <tr
                    key={c.id}
                    onClick={() => setCanalSelecionadoId(c.id)}
                    className="glass cursor-pointer bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">{c.nome || '—'}</div>
                          <div className="text-xs text-[var(--text-muted)] font-mono">{c.telefone || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3"><StatusNumero canal={c} agoraMs={agoraMs} /></td>
                    <td className="py-3 px-3 text-xs text-[var(--text-secondary)]" title={formatarDataHora(c.primeiroVistoEm ?? c.criadoEmOrigem)}>
                      {formatarDataHora(c.primeiroVistoEm ?? c.criadoEmOrigem)}
                    </td>
                    <td className="py-3 px-3 text-xs text-[var(--text-secondary)]" title={formatarDataHora(c.primeiroLeadEm)}>
                      {formatarDataHora(c.primeiroLeadEm)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-[var(--text-primary)]">{c.leadsHoje}</td>
                    <td className="py-3 px-3"><LeadsRecentes dados={c.leadsPorDia} /></td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-[var(--text-primary)]">{c.funis}</td>
                    <td className="py-3 px-3 text-xs font-medium" title={formatarDataHora(c.ultimoLeadEm)}>
                      <span className={ultimoLead.cor}>{ultimoLead.texto}</span>
                    </td>
                    <td className="py-3 px-3"><QualityBadge rating={c.qualityRating} /></td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setCanalSelecionadoId(c.id) }}
                          className="p-1 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--d1)] hover:bg-[var(--bg-elevated)]"
                          title="Ver relatório de aquecimento"
                        >
                          <BarChart3 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePinNumero(c.id) }}
                          className="p-1 rounded transition-colors"
                          style={{ color: pinado ? 'var(--d1)' : 'var(--text-muted)' }}
                          title={pinado ? 'Desafixar da Home' : 'Fixar na Home'}
                        >
                          <Pin size={13} fill={pinado ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {canalSelecionado && <DetalhesNumero canal={canalSelecionado} agoraMs={agoraMs} onClose={() => setCanalSelecionadoId(null)} />}
    </section>
  )
}
