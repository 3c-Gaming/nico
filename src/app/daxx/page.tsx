'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import type { DisparoDaxx, Disparo } from '@/types'

interface ResultadoCampanha {
  registros: number
  ftds: number
  cpas: number
}

interface ExportItem {
  acid?: string
  marketing_source_id?: string
  registrations?: number
  ftds?: number
  cpa?: number
}

const CACHE_KEY = 'daxx-campanhas'
const TS_KEY = 'daxx-campanhas-timestamp'

function parseDataDaxx(str: string): Date | null {
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  return new Date(+match[3], +match[2] - 1, +match[1])
}

function daxxDateToISO(str: string): string | null {
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR')
}

function carregarCache(): { data: DisparoDaxx[]; timestamp: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const ts = localStorage.getItem(TS_KEY)
    if (!raw || !ts) return null
    return { data: JSON.parse(raw), timestamp: ts }
  } catch {
    return null
  }
}

function salvarCache(data: DisparoDaxx[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    localStorage.setItem(TS_KEY, new Date().toISOString())
  } catch {
    /* quota */
  }
}

function StatusBadge({ status }: { status: string }) {
  const cor =
    status === 'Concluído' ? 'var(--success)' :
    status === 'Executando' ? 'var(--d3)' :
    'var(--warning)'
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: `${cor}18`, color: cor }}>
      {status}
    </span>
  )
}

export default function DaxxPage() {
  const [campanhas, setCampanhas] = useState<DisparoDaxx[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingLink, setLoadingLink] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const [dataInicio, setDataInicio] = useState(hojeISO)
  const [dataFim, setDataFim] = useState(hojeISO)
  const [busca, setBusca] = useState('')

  const [resultados, setResultados] = useState<Map<string, ResultadoCampanha>>(new Map())
  const [loadingResultados, setLoadingResultados] = useState(false)

  const fetchData = useCallback(async (isRefresh = false, background = false) => {
    if (isRefresh) setRefreshing(true)
    else if (background) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const url = isRefresh ? '/api/daxx/campanhas/refresh' : '/api/daxx/campanhas'
      const res = await fetch(url)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Erro ${res.status}`)
      }
      const d = await res.json()
      const lista = d.campanhas ?? []
      if (lista.length > 0 || isRefresh) {
        setCampanhas(lista)
        salvarCache(lista)
      }
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const cached = carregarCache()
    if (cached) {
      setCampanhas(cached.data)
      setLastUpdate(new Date(cached.timestamp).toLocaleTimeString('pt-BR'))
      setLoading(false)
      fetchData(false, true)
    } else {
      fetchData()
    }
  }, [fetchData])

  // Buscar resultados (registros/ftds/cpas) das casas ao carregar campanhas
  useEffect(() => {
    if (!campanhas.length) return
    let cancelled = false

    async function buscarResultados() {
      setLoadingResultados(true)
      try {
        // 1) Buscar todos os disparos para mapear templateDaxx.id → utm/betmgmPid
        const resDisp = await fetch('/api/disparos')
        if (!resDisp.ok) throw new Error('Erro ao buscar disparos')
        const { disparos } = await resDisp.json() as { disparos: Disparo[] }

        // Map: daxxCampaignId → disparo[]
        const dispPorDaxx = new Map<string, Disparo[]>()
        for (const d of disparos) {
          if (!d.templateDaxx?.id) continue
          const list = dispPorDaxx.get(d.templateDaxx.id)
          if (list) list.push(d)
          else dispPorDaxx.set(d.templateDaxx.id, [d])
        }

        // 2) Agrupar campanhas por data (YYYY-MM-DD) para minimizar chamadas à API
        const porData = new Map<string, DisparoDaxx[]>()
        for (const c of campanhas) {
          const iso = daxxDateToISO(c.dataCriacao)
          if (!iso) continue
          const list = porData.get(iso)
          if (list) list.push(c)
          else porData.set(iso, [c])
        }

        // 3) Buscar dados de export para cada data única
        const datasUnicas = [...porData.keys()]
        const exportPorData = new Map<string, { superbet: ExportItem[]; mgm: ExportItem[] }>()

        await Promise.allSettled(
          datasUnicas.map(async (date) => {
            const res = await fetch(`/api/casas/export?date=${date}`)
            if (!res.ok) return
            const data = await res.json()
            exportPorData.set(date, {
              superbet: (data.superbet?.data as ExportItem[]) ?? [],
              mgm: (data.mgm?.data as ExportItem[]) ?? [],
            })
          }),
        )

        // 4) Para cada campanha, cruzar utm/pid dos disparos vinculados com os dados exportados
        const nuevos = new Map<string, ResultadoCampanha>()

        for (const [date, cams] of porData) {
          const exportData = exportPorData.get(date)
          if (!exportData) continue

          for (const c of cams) {
            const disps = dispPorDaxx.get(c.id) ?? []
            if (!disps.length) continue

            let registros = 0
            let ftds = 0
            let cpas = 0

            for (const d of disps) {
              // Superbet: match via acid.includes(utm)
              if (d.utm) {
                for (const item of exportData.superbet) {
                  const acid = String(item.acid ?? '')
                  if (acid.includes(d.utm)) {
                    registros += item.registrations ?? 0
                    ftds += item.ftds ?? 0
                    cpas += item.cpa ?? 0
                  }
                }
              }
              // BetMGM: match via marketing_source_id === betmgmPid
              if (d.betmgmPid) {
                for (const item of exportData.mgm) {
                  if (String(item.marketing_source_id ?? '') === d.betmgmPid) {
                    registros += item.registrations ?? 0
                    ftds += item.ftds ?? 0
                    cpas += item.cpa ?? 0
                  }
                }
              }
            }

            if (registros > 0 || ftds > 0 || cpas > 0) {
              nuevos.set(c.id, { registros, ftds, cpas })
            }
          }
        }

        if (!cancelled) setResultados(nuevos)
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoadingResultados(false)
      }
    }

    buscarResultados()
    return () => { cancelled = true }
  }, [campanhas])

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    return campanhas.filter((c) => {
      if (termo && !c.nome.toLowerCase().includes(termo)) return false
      const dt = parseDataDaxx(c.dataCriacao)
      if (!dt) return true
      if (dataInicio && dt < new Date(dataInicio + 'T00:00:00')) return false
      if (dataFim) {
        const fim = new Date(dataFim + 'T23:59:59')
        if (dt > fim) return false
      }
      return true
    })
  }, [campanhas, dataInicio, dataFim, busca])

  async function handleVerMensagem(id: string) {
    setLoadingLink(id)
    try {
      const res = await fetch(`/api/daxx/campanhas/${id}/template`)
      if (!res.ok) throw new Error('Erro ao carregar template')
      const data = await res.json()
      if (data.link) {
        window.open(data.link, '_blank')
      }
    } catch {
      /* nada */
    } finally {
      setLoadingLink(null)
    }
  }

  return (
    <>
      <PageHeader
        titulo="Campanhas DAXX"
        descricao="Disparos reais na plataforma DisparosSimples"
        acoes={
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {!loading && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[160px] max-w-[240px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus:border-[var(--d3)] transition-colors"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">De</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="px-2 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">Até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="px-2 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none"
              />
            </div>
            {lastUpdate && (
              <span className="text-xs text-[var(--text-muted)] ml-auto">
                Última atualização: {lastUpdate}
              </span>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        )}

        {!loading && campanhas.length === 0 && !error && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhuma campanha encontrada na DAXX.
          </div>
        )}

        {!loading && campanhas.length > 0 && (
          <>
            <div className="text-xs text-[var(--text-muted)] text-right">
              {filtradas.length} de {campanhas.length} campanha(s)
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Nome</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Base</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Entregues</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Lidas</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Rejeitados</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">
                      {loadingResultados ? <Spinner size={12} /> : 'Registros'}
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">
                      {loadingResultados ? <Spinner size={12} /> : 'FTDs'}
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">
                      {loadingResultados ? <Spinner size={12} /> : 'CPAs'}
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Responsável</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Data</th>
                    <th className="py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Msg</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((c) => (
                    <tr key={c.id || `${c.nome}-${c.dataCriacao}`} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50 transition-colors">
                      <td className="py-3 px-3 font-medium text-[var(--text-primary)] max-w-[240px] truncate" title={c.nome}>{c.nome}</td>
                      <td className="py-3 px-3"><StatusBadge status={c.status} /></td>
                      <td className="py-3 px-3 text-right font-mono text-[var(--text-primary)]">{formatNumero(c.totalBase)}</td>
                      <td className="py-3 px-3 text-right font-mono text-green-500">{formatNumero(c.entregues)}</td>
                      <td className="py-3 px-3 text-right font-mono text-[var(--d1)]">{formatNumero(c.lidas)}</td>
                      <td className="py-3 px-3 text-right font-mono text-red-400">{formatNumero(c.rejeitados)}</td>
                      <td className="py-3 px-3 text-right font-mono text-[var(--d1)]">
                        {(() => {
                          const r = resultados.get(c.id)
                          return r ? formatNumero(r.registros) : <span className="text-[var(--text-muted)]">—</span>
                        })()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-green-500">
                        {(() => {
                          const r = resultados.get(c.id)
                          return r ? formatNumero(r.ftds) : <span className="text-[var(--text-muted)]">—</span>
                        })()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[var(--warning)]">
                        {(() => {
                          const r = resultados.get(c.id)
                          return r ? formatNumero(r.cpas) : <span className="text-[var(--text-muted)]">—</span>
                        })()}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{c.responsavel}</td>
                      <td className="py-3 px-3 text-[var(--text-muted)] text-xs">{c.dataCriacao}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleVerMensagem(c.id)}
                          disabled={loadingLink === c.id}
                          className="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors"
                          title="Ver mensagem"
                        >
                          {loadingLink === c.id ? <Spinner size={14} /> : <ExternalLink size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
