'use client'

import { useMemo, useState, useEffect, useRef, Fragment, useCallback } from 'react'
import { ChevronRight, ChevronDown, RefreshCw, AlertTriangle, Play, ExternalLink, Pause, FileText, Layers, Pin, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useMonitoramento, POLL_INTERVAL } from '@/hooks/useMonitoramento'
import { getState, togglePinNumero } from '@/lib/store'
import type { NumeroMonitorado, NumeroSendpulse, FluxoSendpulse } from '@/types'

interface BotTestApiResult {
  botId: string
  nome?: string
  status: string
  ultimoTeste?: string
  erro?: string
  duracaoMs?: number
  pendente?: boolean
  ultimoTesteOkMs?: number
  ultimoTriggerOkMs?: number
}

const TESTE_STATUS: Record<string, { label: string; cor: string; dot: string }> = {
  ok: { label: 'Online', cor: 'text-green-500', dot: 'bg-green-500' },
  erro: { label: 'Erro', cor: 'text-red-500', dot: 'bg-red-500' },
  sem_resposta: { label: 'Sem resposta', cor: 'text-amber-400', dot: 'bg-amber-400' },
  pendente: { label: 'Testando...', cor: 'text-blue-400', dot: 'bg-blue-400' },
}

function formatTempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'agora'
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function TesteStatusBadge({ resultado }: { resultado?: BotTestApiResult }) {
  if (!resultado) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
        <span className="inline-block w-2 h-2 rounded-full bg-[var(--text-muted)]/30" />
        Sem teste
      </span>
    )
  }
  const cfg = TESTE_STATUS[resultado.status] ?? TESTE_STATUS.pendente
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.cor}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {resultado.ultimoTeste && (
        <span className="text-[10px] text-[var(--text-muted)] ml-1">{formatTempoRelativo(resultado.ultimoTeste)}</span>
      )}
      {resultado.erro && (
        <span className="text-[10px] text-[var(--error)] ml-1 truncate max-w-[120px]" title={resultado.erro}>{resultado.erro}</span>
      )}
    </span>
  )
}

function UltimaResposta({ ultimoAumentoMs }: { ultimoAumentoMs?: number }) {
  if (!ultimoAumentoMs) return <span className="text-xs text-[var(--text-muted)]/50">—</span>
  const diff = Date.now() - ultimoAumentoMs
  if (diff < 60000) return <span className="text-xs text-green-500 font-medium">agora</span>
  if (diff < 3600000) return <span className="text-xs text-green-500 font-medium">há {Math.floor(diff / 60000)}min</span>
  if (diff < 86400000) return <span className="text-xs text-amber-400 font-medium">há {Math.floor(diff / 3600000)}h</span>
  return <span className="text-xs text-[var(--text-muted)]">{new Date(ultimoAumentoMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
}

function UltimaAtualizacao({ iso }: { iso: string }) {
  const date = new Date(iso)
  const agora = Date.now()
  const diff = Math.floor((agora - date.getTime()) / 1000)
  if (diff < 5) return 'agora'
  if (diff < 60) return `há ${diff}s`
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function FluxosLinha({ botId, telefone, aberto }: { botId: string; telefone: string; aberto: boolean }) {
  const router = useRouter()
  const [fluxos, setFluxos] = useState<FluxoSendpulse[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const [contagensTotal, setContagensTotal] = useState<Record<string, number>>({})
  const [carregandoTags, setCarregandoTags] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!aberto || fetchedRef.current) return
    fetchedRef.current = true
    setCarregando(true)
    fetch(`/api/sendpulse/fluxos?bot_id=${encodeURIComponent(botId)}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(async (json) => {
        const flows: FluxoSendpulse[] = json.fluxos
        setFluxos(flows)
        setCarregando(false)

        const configs = getState().flowTagConfigs
        const flowsComTags = flows.filter((f) => configs[f.id]?.tags?.length)
        if (flowsComTags.length === 0) return

        setCarregandoTags(true)
        try {
          const allTags = [...new Set(flowsComTags.flatMap((f) => configs[f.id].tags))]

          const res = await fetch('/api/leadhub/contagem-por-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: allTags }),
          })

          if (res.ok) {
            const data = await res.json()
            setContagens(data.leads ?? {})
            setContagensTotal(data.totais ?? {})
          }
        } catch {}
        setCarregandoTags(false)
      })
      .catch(() => { setErro('Erro ao carregar fluxos'); setCarregando(false) })
  }, [aberto, botId])

  useEffect(() => {
    if (!aberto) { fetchedRef.current = false }
  }, [aberto])

  if (!aberto) return null

  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="py-3 px-6 glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)]">
          {carregando && <Spinner size={16} />}
          {erro && <span className="text-xs text-[var(--error)]">{erro}</span>}
          {fluxos && fluxos.length === 0 && (
            <span className="text-xs text-[var(--text-muted)]">Nenhum fluxo encontrado</span>
          )}
          {fluxos && fluxos.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex items-center gap-3 px-2 pt-1 pb-2 text-[11px] text-[var(--text-muted)]/60">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-sm bg-[var(--d3)]/60" />
                  <span>Novos contatos hoje</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-sm bg-[var(--text-primary)]/40" />
                  <span>Total de contatos no fluxo</span>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left py-1.5 px-2 font-medium text-[var(--text-muted)] w-16">Funil</th>
                    <th className="text-left py-1.5 px-2 font-medium text-[var(--text-muted)]">Fluxo</th>
                    <th className="text-left py-1.5 px-2 font-medium text-[var(--text-muted)]">Status</th>
                    <th className="text-right py-1.5 px-2 font-medium text-[var(--text-muted)]">Leads hoje</th>
                    <th className="text-right py-1.5 px-2 font-medium text-[var(--text-muted)]">Total</th>
                    <th className="text-center py-1.5 px-2 font-medium text-[var(--text-muted)]">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {fluxos.map((fluxo) => {
                    const tagsDoFlow = getState().flowTagConfigs[fluxo.id]?.tags
                    const temTags = !!tagsDoFlow?.length
                    const carregando = temTags && carregandoTags

                    const totalLeads = tagsDoFlow
                      ? tagsDoFlow.reduce((acc, t) => acc + (contagens[t] ?? 0), 0)
                      : 0
                    const totalGeral = tagsDoFlow
                      ? tagsDoFlow.reduce((acc, t) => acc + (contagensTotal[t] ?? 0), 0)
                      : 0
                    const temLeads = totalLeads > 0
                    const temTotal = totalGeral > 0
                    return (
                      <tr key={fluxo.id} className="border-b border-[var(--glass-border)]/50">
                        <td className="py-2 px-2">
                          {(() => {
                            const funil = getState().flowTagConfigs[fluxo.id]?.funil
                            return funil ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-[var(--d1)]/15 border border-[var(--d1)]/30 text-[var(--d1)]">
                                <Layers size={10} />
                                {funil}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)]/30 italic">Sem Funil</span>
                            )
                          })()}
                        </td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => router.push(`/funis?busca=${encodeURIComponent(fluxo.nome)}`)}
                            className="text-left text-[var(--text-primary)] font-medium hover:text-[var(--d1)] transition-colors cursor-pointer"
                          >
                            {fluxo.nome}
                          </button>
                          {fluxo.triggers.length > 0 && (
                            <div className="text-[var(--text-muted)]">{fluxo.triggers.map((t) => t.nome).join(', ')}</div>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex items-center gap-1 ${
                            fluxo.status === 'ativo' ? 'text-green-500' :
                            fluxo.status === 'inativo' ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {fluxo.status === 'ativo' ? <Play size={10} /> :
                             fluxo.status === 'rascunho' ? <FileText size={10} /> : <Pause size={10} />}
                            {fluxo.status === 'ativo' ? 'Ativo' :
                             fluxo.status === 'inativo' ? 'Inativo' : 'Rascunho'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          {carregando ? (
                            <Spinner size={12} />
                          ) : !temTags ? (
                            <span className="text-[var(--text-muted)]/40 text-[11px]">—</span>
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`font-semibold leading-tight ${temLeads ? 'text-[var(--d3)]' : 'text-[var(--text-muted)]'}`}>
                                {totalLeads}
                              </span>
                              <span className="text-[10px] leading-none text-[var(--text-muted)]/50">
                                novos hoje
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {carregando ? (
                            <Spinner size={12} />
                          ) : !temTags ? (
                            <span className="text-[var(--text-muted)]/40 text-[11px]">—</span>
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`font-semibold leading-tight ${temTotal ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                                {totalGeral}
                              </span>
                              <span className="text-[10px] leading-none text-[var(--text-muted)]/50">
                                {temTotal ? 'total no fluxo' : 'sem contatos'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <a
                            href={`https://wa.pulse.is/${telefone}?start=${fluxo.id}&text=Start`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-2 py-1 rounded text-[11px] font-medium text-[var(--d3)] hover:bg-[var(--d3)]/10 transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function NumerosPage() {
  const { data, loading, refreshing, error, atualizar, proximaAtualizacao, botTestMap } = useMonitoramento()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [testandoBotId, setTestandoBotId] = useState<string | null>(null)
  const [leadsHojeMap, setLeadsHojeMap] = useState<Record<string, number>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const buscarLeadsHoje = useCallback(async () => {
    if (!data?.numeros) return
    const configs = getState().flowTagConfigs
    const results = await Promise.all(
      data.numeros.map(async (n) => {
        const tags = [...new Set(
          Object.values(configs)
            .filter(c => c.botId === n.numero.id && c.tags?.length)
            .flatMap(c => c.tags)
        )]
        if (tags.length === 0) return [n.numero.id, 0] as const
        try {
          const res = await fetch('/api/leadhub/contagem-por-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags }),
          })
          if (!res.ok) return [n.numero.id, 0] as const
          const { leads } = await res.json()
          const total = Object.values(leads as Record<string, number>).reduce((s, n) => s + n, 0)
          return [n.numero.id, total] as const
        } catch {
          return [n.numero.id, 0] as const
        }
      })
    )
    setLeadsHojeMap(Object.fromEntries(results))
  }, [data?.numeros])

  useEffect(() => {
    buscarLeadsHoje()
  }, [buscarLeadsHoje])

  const handleCopiarId = useCallback((id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [])

  const handleTestarBot = useCallback(async (botId: string) => {
    if (testandoBotId) return
    setTestandoBotId(botId)
    try {
      const res = await fetch('/api/bot-test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      })
      if (!res.ok) throw new Error()
      await atualizar()
      buscarLeadsHoje()
    } catch {
    } finally {
      setTestandoBotId(null)
    }
  }, [testandoBotId, atualizar, buscarLeadsHoje])

  const numerosOrdenados = useMemo(() => {
    if (!data?.numeros) return []
    return [...data.numeros]
      .filter((n): n is NumeroMonitorado & { numero: NumeroSendpulse } => !!n.numero)
      .sort((a, b) => {
        const va = a.ultimoAumentoMs ?? 0
        const vb = b.ultimoAumentoMs ?? 0
        if (va !== vb) return vb - va
        return a.numero.nome.localeCompare(b.numero.nome)
      })
  }, [data?.numeros])

  return (
    <>
      <PageHeader
        titulo="Números"
        descricao="Monitoramento de chatbots"
        acoes={
          <button
            onClick={atualizar}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        )}

        {data && data.numeros.length === 0 && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum número encontrado na Sendpulse.
          </div>
        )}

        {data && data.numeros.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                {refreshing && <Spinner size={12} />}
                <span className={refreshing ? 'text-[var(--d3)]' : ''}>
                  {refreshing ? 'Recarregando...' : '✓ Atualizado'}
                </span>
              </div>
              {!refreshing && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--d1)] rounded-full transition-[width] duration-1000"
                      style={{ width: `${(proximaAtualizacao / (POLL_INTERVAL / 1000)) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums w-6 text-right">{proximaAtualizacao}s</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span>Última atualização:</span>
                <UltimaAtualizacao iso={data.ultimaAtualizacao} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-[var(--glass-border)]">
                      <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Nome / Número</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Bot ID</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Funis Ativos</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Leads Hoje</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Última resposta</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Status Teste</th>
                    </tr>
                </thead>
                <tbody>
                  {numerosOrdenados.map((item: NumeroMonitorado) => {
                    const isExpanded = expandedId === item.numero.id
                    return (
                    <Fragment key={item.numero.id}>
                    <tr className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.numero.id)}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" /> : <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />}
                          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${item.numero.status === 'ativo' ? 'bg-green-500' : 'bg-red-400'}`} />
                          <div>
                            <div className="font-medium text-[var(--text-primary)]">{item.numero.nome}</div>
                            <div className="text-xs text-[var(--text-muted)] font-mono">{item.numero.numero}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopiarId(item.numero.id) }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                          title="Copiar Bot ID"
                        >
                          {copiedId === item.numero.id ? (
                            <><Check size={10} className="text-green-500" /> <span className="text-green-500">Copiado</span></>
                          ) : (
                            <><Copy size={10} /> {item.numero.id}</>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {(() => {
                          const configs = getState().flowTagConfigs
                          const ativos = Object.values(configs).filter(
                            (c) => c.botId === item.numero.id && c.tags?.length
                          ).length
                          return <span className="text-[var(--text-primary)] font-semibold">{ativos}</span>
                        })()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold ${leadsHojeMap[item.numero.id] > 0 ? 'text-[var(--d3)]' : 'text-[var(--text-muted)]'}`}>
                          {leadsHojeMap[item.numero.id] ?? <Spinner size={12} />}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <UltimaResposta ultimoAumentoMs={item.ultimoAumentoMs} />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TesteStatusBadge resultado={botTestMap.get(item.numero.id)} />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTestarBot(item.numero.id) }}
                            disabled={testandoBotId === item.numero.id}
                            className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40"
                            title="Testar bot"
                          >
                            {testandoBotId === item.numero.id ? (
                              <Spinner size={12} />
                            ) : (
                              <Play size={13} />
                            )}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePinNumero(item.numero.id) }}
                            className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                            title={getState().pinnedNumeros.includes(item.numero.id) ? 'Desafixar da Home' : 'Fixar na Home'}
                          >
                            <Pin size={13} className={getState().pinnedNumeros.includes(item.numero.id) ? 'text-amber-400' : 'text-[var(--text-muted)]/40'} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <FluxosLinha botId={item.numero.id} telefone={item.numero.numero} aberto={isExpanded} />
                    </Fragment>
                    )}
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
