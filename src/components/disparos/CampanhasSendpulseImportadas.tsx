'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ExternalLink, Megaphone, Check, ChevronRight, ChevronDown, MousePointerClick } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { UtmComboBox } from '../ui/UtmComboBox'
import { useToast } from '../ui/Toast'
import type { CampanhaSendpulseImportada, RelatorioCampanhaSendpulse, ResumoDestinatariosCampanha } from '@/types'

interface CampanhaComRelatorio extends CampanhaSendpulseImportada {
  relatorio: RelatorioCampanhaSendpulse | null
  resultadoUtm: { registros: number; ftds: number } | null
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** SendPulse não documenta o significado dos códigos numéricos de status de campanha — deriva um
 * rótulo a partir dos próprios números de envio, que são inequívocos. */
function statusDaCampanha(r: RelatorioCampanhaSendpulse | null): { texto: string; cor: string } {
  if (!r) return { texto: 'sem dados', cor: 'text-[var(--text-muted)]' }
  const { sent, all } = r.stats.destinatarios
  if (all === 0) return { texto: 'sem destinatários', cor: 'text-[var(--text-muted)]' }
  if (sent === 0) return { texto: 'agendada', cor: 'text-amber-400' }
  if (sent < all) return { texto: 'enviando', cor: 'text-[var(--d1)]' }
  return { texto: 'enviada', cor: 'text-[var(--success)]' }
}

interface LinhaCampanhaProps {
  campanha: CampanhaComRelatorio
  onSalvarUtm: (id: string, utm: string) => Promise<void>
  onExcluir: (id: string) => void
}

function formatarPct(parte: number, total: number): string {
  if (total <= 0) return '—'
  return `${((parte / total) * 100).toFixed(1)}%`
}

/** UTM em estado local — só grava (PATCH) quando o usuário clica em salvar, mesmo princípio dos
 * outros campos editáveis desse tipo no app (ver FlowTagEditor em Funis): UtmComboBox dispara
 * onChange a cada tecla, gravar isso direto faria um PATCH por letra digitada. */
function LinhaCampanha({ campanha: c, onSalvarUtm, onExcluir }: LinhaCampanhaProps) {
  const [utm, setUtm] = useState(c.utm ?? '')
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [destinatarios, setDestinatarios] = useState<ResumoDestinatariosCampanha | null>(null)
  const [carregandoDestinatarios, setCarregandoDestinatarios] = useState(false)
  useEffect(() => { setUtm(c.utm ?? '') }, [c.utm])

  const st = statusDaCampanha(c.relatorio)
  const mudou = utm !== (c.utm ?? '')

  async function salvar() {
    setSalvando(true)
    try {
      await onSalvarUtm(c.id, utm)
    } finally {
      setSalvando(false)
    }
  }

  function toggleAberto() {
    const vaiAbrir = !aberto
    setAberto(vaiAbrir)
    if (vaiAbrir && !destinatarios) {
      setCarregandoDestinatarios(true)
      fetch(`/api/sendpulse/campanhas/${c.id}/destinatarios`)
        .then((r) => r.json())
        .then((data) => setDestinatarios(data.resumo ?? null))
        .catch(() => setDestinatarios(null))
        .finally(() => setCarregandoDestinatarios(false))
    }
  }

  const dest = c.relatorio?.stats.destinatarios
  const msgs = c.relatorio?.stats.mensagens

  return (
    <>
      <tr className="border-b border-[var(--glass-border)] last:border-0">
        <td className="px-3 py-2 text-xs text-[var(--text-primary)] max-w-[240px]">
          <button onClick={toggleAberto} className="flex items-center gap-1 hover:text-[var(--d1)] transition-colors w-full text-left" title="Ver detalhes de engajamento (cliques por botão, quem clicou)">
            {aberto ? <ChevronDown size={12} className="shrink-0 text-[var(--text-muted)]" /> : <ChevronRight size={12} className="shrink-0 text-[var(--text-muted)]" />}
            <span className="truncate" title={c.titulo}>{c.titulo}</span>
          </button>
        </td>
        <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{formatarData(c.sendAt ?? c.criadoEmSendpulse)}</td>
        <td className={`px-3 py-2 text-xs font-medium ${st.cor}`}>{st.texto}</td>
        <td className="px-3 py-2 text-right text-xs font-mono text-[var(--text-primary)]">{dest?.all ?? '—'}</td>
        <td className="px-3 py-2 text-right text-xs font-mono text-[var(--text-primary)]">{dest?.sent ?? '—'}</td>
        <td className="px-3 py-2 text-right text-xs font-mono text-[var(--text-primary)]">{dest?.delivered ?? '—'}</td>
        <td className="px-3 py-2 text-right text-xs font-mono text-[var(--d1)]">{dest?.opened ?? '—'}</td>
        <td className="px-3 py-2 w-40">
          <div className="flex items-center gap-1">
            <UtmComboBox value={utm} onChange={setUtm} placeholder="vincular UTM..." size="sm" />
            {mudou && (
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0 disabled:opacity-40"
                title="Salvar UTM"
              >
                {salvando ? <Spinner size={12} /> : <Check size={13} />}
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-right text-xs font-mono text-[var(--text-primary)]">{c.utm ? (c.resultadoUtm?.registros ?? 0) : '—'}</td>
        <td className="px-3 py-2 text-right text-xs font-mono text-[var(--d1)]">{c.utm ? (c.resultadoUtm?.ftds ?? 0) : '—'}</td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-1">
            <a
              href={`https://login.sendpulse.com/messengers/campaign/${c.canal}/${c.id}/report/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              title="Abrir no painel da SendPulse"
            >
              <ExternalLink size={13} />
            </a>
            <button
              onClick={() => onExcluir(c.id)}
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-elevated)] transition-colors"
              title="Remover"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
      {aberto && (
        <tr className="border-b border-[var(--glass-border)] last:border-0 bg-[var(--bg-elevated)]/40">
          <td colSpan={11} className="px-4 py-3">
            {carregandoDestinatarios ? (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Spinner size={14} /> Carregando engajamento...</div>
            ) : !destinatarios ? (
              <p className="text-xs text-[var(--error)]">Erro ao carregar detalhes de engajamento.</p>
            ) : (
              <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-6">
                <div>
                  <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Funil de entrega</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Destinatários</span><span className="font-mono text-[var(--text-primary)]">{dest?.all ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Entregues</span><span className="font-mono text-[var(--text-primary)]">{dest?.delivered ?? '—'} <span className="text-[var(--text-muted)]">({formatarPct(dest?.delivered ?? 0, dest?.all ?? 0)})</span></span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Rejeitados</span><span className="font-mono text-[var(--error)]">{dest?.rejected ?? '—'} <span className="text-[var(--text-muted)]">({formatarPct(dest?.rejected ?? 0, dest?.all ?? 0)})</span></span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Com atividade</span><span className="font-mono text-[var(--text-primary)]">{dest?.activity ?? '—'} <span className="text-[var(--text-muted)]">({formatarPct(dest?.activity ?? 0, dest?.delivered ?? 0)})</span></span></div>
                    <div className="flex justify-between"><span className="text-[var(--d1)] font-medium">Clicaram (algum botão)</span><span className="font-mono text-[var(--d1)] font-medium">{destinatarios.clicaram} <span className="text-[var(--text-muted)]">({formatarPct(destinatarios.clicaram, dest?.delivered ?? 0)})</span></span></div>
                    {destinatarios.escaneados < destinatarios.total && (
                      <p className="text-[10px] text-[var(--text-muted)] pt-1">Escaneados {destinatarios.escaneados} de {destinatarios.total} destinatários (amostra).</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5 flex items-center gap-1"><MousePointerClick size={11} /> Cliques por botão</p>
                  {destinatarios.porBotao.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">Nenhum clique registrado ainda.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {destinatarios.porBotao.map((b) => (
                        <div key={b.titulo} className="text-xs">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[var(--text-primary)] truncate" title={b.titulo}>{b.titulo}</span>
                            <span className="font-mono text-[var(--d1)] shrink-0 ml-2">{b.cliques}</span>
                          </div>
                          <div className="h-1 rounded bg-[var(--bg-surface)] overflow-hidden">
                            <div
                              className="h-full bg-[var(--d1)]"
                              style={{ width: `${Math.min(100, (b.cliques / (destinatarios.porBotao[0]?.cliques || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Quem clicou</p>
                  {destinatarios.quemClicou.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">Ninguém clicou ainda.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {destinatarios.quemClicou.map((q, i) => (
                        <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]" title={q.botoesClicados.join(', ')}>
                          {q.username ?? q.nome}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function CampanhasSendpulseImportadas() {
  const [campanhas, setCampanhas] = useState<CampanhaComRelatorio[] | null>(null)
  const [input, setInput] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const { addToast } = useToast()

  const carregar = useCallback(() => {
    fetch('/api/sendpulse/campanhas')
      .then((r) => r.json())
      .then((data) => setCampanhas(data.campanhas ?? []))
      .catch(() => setCampanhas([]))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function adicionar() {
    if (!input.trim()) return
    setAdicionando(true)
    setErro(null)
    try {
      const res = await fetch('/api/sendpulse/campanhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao adicionar campanha')
        return
      }
      setInput('')
      addToast('success', `Campanha "${data.campanha.titulo}" importada`)
      carregar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setAdicionando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Remover essa campanha importada? Ela continua existindo na SendPulse, só some daqui.')) return
    setCampanhas((prev) => prev?.filter((c) => c.id !== id) ?? null)
    await fetch(`/api/sendpulse/campanhas?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  async function salvarUtm(id: string, utm: string) {
    const res = await fetch('/api/sendpulse/campanhas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, utm: utm || null }),
    })
    if (!res.ok) {
      addToast('error', 'Erro ao salvar UTM')
      return
    }
    addToast('success', 'UTM vinculada')
    carregar()
  }

  return (
    <div className="px-6 pt-6 pb-4 space-y-3 border-b border-[var(--border)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Megaphone size={15} className="text-[var(--d1)]" />
          Campanhas SendPulse
          <span className="text-xs font-normal text-[var(--text-muted)]" title="Campanhas criadas direto no painel da SendPulse (fora do nico) — a API não lista sozinha, precisa importar uma a uma pelo link">
            desde o início do mês
          </span>
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          placeholder="Cole o link ou ID da campanha no painel da SendPulse..."
          className="flex-1 max-w-md h-8 px-3 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
        />
        <Button size="sm" onClick={adicionar} loading={adicionando} icon={<Plus size={14} />}>
          Adicionar
        </Button>
      </div>
      {erro && <p className="text-xs text-[var(--error)]">{erro}</p>}

      {campanhas === null ? (
        <div className="flex justify-center py-6"><Spinner size={20} /></div>
      ) : campanhas.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">Nenhuma campanha importada ainda esse mês.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)] bg-[var(--bg-elevated)]">
                <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2">Título</th>
                <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2">Agendado/Criado</th>
                <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2">Status</th>
                <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2">Destinatários</th>
                <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2">Enviadas</th>
                <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2">Entregues</th>
                <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2">Abertas</th>
                <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2" title="Vincula essa campanha a uma UTM/PID pra cruzar com registros/FTDs reais (SuperBet/BetMGM)">UTM</th>
                <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2">Reg</th>
                <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2">FTDs</th>
                <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2 w-16">Ações</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => (
                <LinhaCampanha key={c.id} campanha={c} onSalvarUtm={salvarUtm} onExcluir={excluir} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
