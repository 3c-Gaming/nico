'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ExternalLink, Megaphone } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { useToast } from '../ui/Toast'
import type { CampanhaSendpulseImportada, RelatorioCampanhaSendpulse } from '@/types'

interface CampanhaComRelatorio extends CampanhaSendpulseImportada {
  relatorio: RelatorioCampanhaSendpulse | null
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
                <th className="text-right text-xs text-[var(--text-muted)] font-medium px-3 py-2 w-16">Ações</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => {
                const st = statusDaCampanha(c.relatorio)
                return (
                  <tr key={c.id} className="border-b border-[var(--glass-border)] last:border-0">
                    <td className="px-3 py-2 text-xs text-[var(--text-primary)] max-w-[280px] truncate" title={c.titulo}>{c.titulo}</td>
                    <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{formatarData(c.sendAt ?? c.criadoEmSendpulse)}</td>
                    <td className={`px-3 py-2 text-xs font-medium ${st.cor}`}>{st.texto}</td>
                    <td className="px-3 py-2 text-right text-xs font-mono text-[var(--text-primary)]">{c.relatorio?.stats.destinatarios.all ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-xs font-mono text-[var(--text-primary)]">{c.relatorio?.stats.destinatarios.sent ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-xs font-mono text-[var(--text-primary)]">{c.relatorio?.stats.destinatarios.delivered ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-xs font-mono text-[var(--d1)]">{c.relatorio?.stats.destinatarios.opened ?? '—'}</td>
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
                          onClick={() => excluir(c.id)}
                          className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-elevated)] transition-colors"
                          title="Remover"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
