'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Sparkles, Check, Link2, ChevronDown, ChevronUp, RefreshCw, Trophy, Newspaper, ExternalLink, MapPin, Clock, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useMonitoramento } from '@/hooks/useMonitoramento'
import { getState } from '@/lib/store'
import { montarLinkWhatsApp } from '@/lib/copa-2026/url'
import { salvarPreferencia, listarPreferencias, removerPreferencia, getResumoPreferencias } from '@/lib/copa-2026/preferencias'
import type { CopaMatch, CopaNoticia, SugestaoCopa, PreferenciaCopa } from '@/types'

function amanhaISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarHorarioBrasilia(utcIso: string): string {
  if (!utcIso) return ''
  try {
    const d = new Date(utcIso.endsWith('Z') ? utcIso : utcIso + 'Z')
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return utcIso
  }
}

function tempoRelativo(dataStr: string): string {
  const data = new Date(dataStr)
  const agora = new Date()
  const diffMs = agora.getTime() - data.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min atrás`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h atrás`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d atrás`
}

export default function Copa2026Page() {
  const { data: monitoramento } = useMonitoramento()
  const [date, setDate] = useState(amanhaISO())
  const [numeroId, setNumeroId] = useState('')
  const [flowId, setFlowId] = useState('')
  const [matches, setMatches] = useState<CopaMatch[]>([])
  const [sugestoes, setSugestoes] = useState<SugestaoCopa[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [loadingSugestoes, setLoadingSugestoes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preferidas, setPreferidas] = useState<PreferenciaCopa[]>([])
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [editandoCopy, setEditandoCopy] = useState<Record<string, string[]>>({})
  const [gerandoLink, setGerandoLink] = useState<Record<string, boolean>>({})
  const [linksGerados, setLinksGerados] = useState<Record<string, string>>({})
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null)
  const [noticias, setNoticias] = useState<Record<number, CopaNoticia[]>>({})
  const [loadingNoticias, setLoadingNoticias] = useState<Record<number, boolean>>({})

  const numeros = useMemo(() => {
    return monitoramento?.numeros ?? []
  }, [monitoramento])

  const flows = useMemo(() => {
    if (!numeroId) return []
    const configs = getState().flowTagConfigs
    return Object.entries(configs)
      .filter(([_, c]) => c.botId === numeroId)
      .map(([fid, c]) => ({ flowId: fid, funil: c.funil }))
  }, [numeroId])

  const SUGESTOES_CACHE_KEY = 'copa2026-sugestoes'

  useEffect(() => {
    setPreferidas(listarPreferencias())
    const cached = localStorage.getItem(SUGESTOES_CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (parsed.date === date && Array.isArray(parsed.sugestoes)) {
          setSugestoes(parsed.sugestoes)
        }
      } catch {}
    }
  }, [])

  useEffect(() => { buscarJogos() }, [])

  async function buscarJogos() {
    setLoadingMatches(true)
    setError(null)
    setSugestoes([])
    try {
      const res = await fetch(`/api/copa-2026/fixtures?date=${date}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).error ?? `Erro ${res.status}`)
      }
      const json = await res.json()
      setMatches(json.matches ?? [])
      if (!json.matches?.length) {
        setError('Nenhum jogo encontrado para esta data.')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMatches(false)
    }
  }

  async function buscarNoticias(matchId: number, team1: string, team2: string) {
    if (noticias[matchId]) return
    setLoadingNoticias((prev) => ({ ...prev, [matchId]: true }))
    try {
      const res = await fetch(`/api/copa-2026/noticias?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`)
      if (!res.ok) return
      const json = await res.json()
      setNoticias((prev) => ({ ...prev, [matchId]: json.noticias ?? [] }))
    } catch {
    } finally {
      setLoadingNoticias((prev) => ({ ...prev, [matchId]: false }))
    }
  }

  function toggleExpand(match: CopaMatch) {
    if (expandedMatchId === match.id) {
      setExpandedMatchId(null)
    } else {
      setExpandedMatchId(match.id)
      buscarNoticias(match.id, match.homeTeam, match.awayTeam)
    }
  }

  async function gerarSugestoes() {
    if (!matches.length) return
    setLoadingSugestoes(true)
    setError(null)
    try {
      const preferencias = getResumoPreferencias()
      const res = await fetch('/api/copa-2026/sugestoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches, data: formatarDataBr(date), preferencias, quantidade: 3 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).error ?? `Erro ${res.status}`)
      }
      const json = await res.json()
      const sugestoesData = json.sugestoes ?? []
      setSugestoes(sugestoesData)
      if (sugestoesData.length === 0) {
        setError('Nenhuma sugestão gerada.')
      } else {
        try {
          localStorage.setItem(SUGESTOES_CACHE_KEY, JSON.stringify({ date: formatarDataBr(date), sugestoes: sugestoesData }))
        } catch {}
      }
      if (json.usouFallback) {
        setError('Cota da IA excedida. Sugestões geradas em modo fallback.')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingSugestoes(false)
    }
  }

  function handlePrefiro(sugestao: SugestaoCopa) {
    const stage = matches[0]?.stage ?? ''
    salvarPreferencia(sugestao, stage)
    setPreferidas(listarPreferencias())
  }

  function jaPreferida(sugestaoId: string): boolean {
    return preferidas.some((p) => p.sugestaoId === sugestaoId)
  }

  async function handleGerarLink(sugestao: SugestaoCopa, idx: number) {
    if (!numeroId || !flowId) {
      setError('Selecione um número e um flow primeiro.')
      return
    }
    setGerandoLink((prev) => ({ ...prev, [sugestao.id]: true }))
    setError(null)
    try {
      const numero = numeros.find((n) => n.numero.id === numeroId)?.numero
      if (!numero) throw new Error('Número não encontrado')
      const texto = sugestao.copyBlocos.join('\n\n').slice(0, 150)
      const linkLongo = montarLinkWhatsApp(numero.numero, flowId, texto)
      const slug = `copa-${date}-${idx}`
      const res = await fetch('/api/switchy/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkLongo, slug, title: sugestao.titulo }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).error ?? `Erro Switchy ${res.status}`)
      }
      const json = await res.json()
      setLinksGerados((prev) => ({ ...prev, [sugestao.id]: json.shortUrl }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGerandoLink((prev) => ({ ...prev, [sugestao.id]: false }))
    }
  }

  function updateCopy(sugestaoId: string, blocoIdx: number, value: string) {
    setEditandoCopy((prev) => {
      const atual = prev[sugestaoId] ?? sugestoes.find((s) => s.id === sugestaoId)?.copyBlocos ?? ['', '', '']
      const novo = [...atual]
      novo[blocoIdx] = value
      return { ...prev, [sugestaoId]: novo }
    })
  }

  function getCopy(sugestao: SugestaoCopa): string[] {
    return editandoCopy[sugestao.id] ?? sugestao.copyBlocos
  }

  return (
    <>
      <PageHeader
        titulo="Copa 2026"
        icon={
          <>
            <img
              src="/world-cup-dark.png"
              alt=""
              className="h-5 w-5 block dark:hidden"
            />
            <img
              src="/world-cup-white.png"
              alt=""
              className="h-5 w-5 hidden dark:block"
            />
          </>
        }
      />

      <div className="max-w-4xl mx-auto px-4 pb-12 space-y-6">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Número</label>
              <select
                value={numeroId}
                onChange={(e) => { setNumeroId(e.target.value); setFlowId('') }}
                className="h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors min-w-[180px]"
              >
                <option value="">Selecionar…</option>
                {numeros.map((n) => (
                  <option key={n.numero.id} value={n.numero.id}>
                    {n.numero.numero} — {n.numero.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Flow</label>
              <select
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
                className="h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors min-w-[180px]"
                disabled={!numeroId}
              >
                <option value="">Selecionar…</option>
                {flows.map((f) => (
                  <option key={f.flowId} value={f.flowId}>
                    {f.flowId.slice(0, 12)}… — {f.funil ?? 'sem funil'}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={buscarJogos}
              disabled={loadingMatches}
              className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium bg-[var(--d1)] text-white hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loadingMatches ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar Jogos
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {matches.length > 0 && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Jogos de {formatarDataBr(date)}
              </h2>
              <span className="text-xs text-[var(--text-muted)]">{matches.length} jogo(s)</span>
            </div>
            <div className="grid gap-2">
              {matches.map((m) => {
                const expanded = expandedMatchId === m.id
                const matchNoticias = noticias[m.id]
                const loadingNews = loadingNoticias[m.id]
                const brDate = formatarHorarioBrasilia(m.date)
                const temPlacar = m.homeScore != null && m.awayScore != null
                return (
                  <div key={m.id} className="rounded bg-[var(--bg-base)] border border-[var(--border)] overflow-hidden">
                    <button
                      onClick={() => toggleExpand(m)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--bg-elevated)]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {m.homeLogo && (
                          <img src={m.homeLogo} alt="" className="w-8 h-8 object-contain shrink-0" />
                        )}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {m.homeTeam}
                          </span>
                          {temPlacar ? (
                            <span className="text-sm font-bold text-[var(--text-primary)] shrink-0">
                              {m.homeScore} × {m.awayScore}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)] shrink-0">vs</span>
                          )}
                          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {m.awayTeam}
                          </span>
                        </div>
                        {m.awayLogo && (
                          <img src={m.awayLogo} alt="" className="w-8 h-8 object-contain shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] shrink-0">
                        <span className="hidden sm:inline">{m.stage}</span>
                        {brDate && <span className="shrink-0">{brDate}</span>}
                        <ChevronRight
                          size={14}
                          className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
                        />
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-[var(--border)] px-3 pb-3 pt-2 space-y-2">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
                          {m.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />
                              {m.venue}{m.city ? `, ${m.city}` : ''}{m.country ? ` — ${m.country}` : ''}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {brDate} BRT
                          </span>
                          <span>{m.stage}{m.group ? ` (${m.group})` : ''}</span>
                          <span className={`capitalize ${m.status === 'finished' ? 'text-green-500' : m.status === 'scheduled' ? 'text-blue-400' : ''}`}>
                            {m.status}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                            <Newspaper size={11} />
                            Últimas Notícias
                          </div>
                          {loadingNews ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] py-1">
                              <RefreshCw size={10} className="animate-spin" />
                              Buscando notícias…
                            </div>
                          ) : matchNoticias && matchNoticias.length > 0 ? (
                            <div className="space-y-0.5">
                              {matchNoticias.map((n, i) => (
                                <a
                                  key={i}
                                  href={n.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-0.5 group"
                                >
                                  <ExternalLink size={9} className="shrink-0 mt-0.5 opacity-40 group-hover:opacity-100" />
                                  <span className="flex-1 leading-tight line-clamp-1">{n.titulo}</span>
                                  <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                                    {n.fonte} · {tempoRelativo(n.data)}
                                  </span>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[var(--text-muted)] py-1">Nenhuma notícia encontrada.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <button
              onClick={gerarSugestoes}
              disabled={loadingSugestoes}
              className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium bg-[var(--d1)] text-white hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loadingSugestoes ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loadingSugestoes ? 'Gerando…' : 'Gerar Sugestões com IA'}
            </button>
          </div>
        )}

        {sugestoes.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Sugestões de Disparo
            </h2>
            {sugestoes.map((sugestao, idx) => {
              const copy = getCopy(sugestao)
              const preferida = jaPreferida(sugestao.id)
              return (
                <div
                  key={sugestao.id}
                  className={`bg-[var(--bg-surface)] border rounded-lg p-4 space-y-3 transition-all ${
                    preferida
                      ? 'border-green-500/40 ring-1 ring-green-500/20'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--d1)]/10 text-[var(--d1)] text-xs font-bold">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {sugestao.titulo}
                      </h3>
                    </div>
                    {preferida && (
                      <span className="flex items-center gap-1 text-xs text-green-500 font-medium bg-green-500/10 px-2 py-0.5 rounded-full">
                        <Check size={12} />
                        Preferida
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {sugestao.matches.map((m, i) => (
                      <span key={i} className="text-xs text-[var(--text-muted)] bg-[var(--bg-base)] px-2 py-0.5 rounded border border-[var(--border)]">
                        {m.homeTeam} 🆚 {m.awayTeam}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    {copy.map((bloco, bi) => (
                      <textarea
                        key={bi}
                        value={bloco}
                        onChange={(e) => updateCopy(sugestao.id, bi, e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors resize-none font-mono"
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    {linksGerados[sugestao.id] ? (
                      <div className="flex items-center gap-2 text-xs text-green-500 bg-green-500/10 px-3 py-1.5 rounded border border-green-500/20">
                        <Link2 size={12} />
                        <a
                          href={linksGerados[sugestao.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline truncate max-w-[300px]"
                        >
                          {linksGerados[sugestao.id]}
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGerarLink(sugestao, idx)}
                        disabled={gerandoLink[sugestao.id] || !numeroId || !flowId}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-all"
                      >
                        {gerandoLink[sugestao.id] ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Link2 size={12} />
                        )}
                        {gerandoLink[sugestao.id] ? 'Gerando…' : 'Gerar Link Switchy'}
                      </button>
                    )}

                    <button
                      onClick={() => handlePrefiro(sugestao)}
                      disabled={preferida}
                      className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium transition-all ${
                        preferida
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-default'
                          : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Check size={12} />
                      {preferida ? 'Preferida' : 'Prefiro essa resposta'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {preferidas.length > 0 && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
            <button
              onClick={() => setHistoricoAberto(!historicoAberto)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
            >
              <span>📋 Preferências Anteriores ({preferidas.length})</span>
              {historicoAberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {historicoAberto && (
              <div className="px-4 pb-4 space-y-2 border-t border-[var(--border)] pt-3">
                {preferidas.slice().reverse().map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 p-2 rounded bg-[var(--bg-base)] border border-[var(--border)]">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {p.sugestao.titulo}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {formatarDataBr(p.data)} — {p.stage}
                      </p>
                    </div>
                    <button
                      onClick={() => { removerPreferencia(p.id); setPreferidas(listarPreferencias()) }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!matches.length && !loadingMatches && !error && (
          <div className="text-center py-16">
            <img
              src="/world-cup-dark.png"
              alt=""
              className="h-16 w-16 mx-auto mb-4 opacity-30 block dark:hidden"
            />
            <img
              src="/world-cup-white.png"
              alt=""
              className="h-16 w-16 mx-auto mb-4 opacity-30 hidden dark:block"
            />
            <p className="text-sm text-[var(--text-muted)]">
              Selecione uma data e clique em "Buscar Jogos" para começar.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
