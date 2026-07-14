'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Send, CheckCircle, XCircle, Clock, Timer, Settings, ChevronDown, ChevronUp, Play, Pause, Zap } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

interface CronConfig {
  pollIntervalMs: number
  cronPaused: boolean
  lastRunAt: string | null
}

interface BotTestResult {
  botId: string
  numero: string
  nome: string
  ultimoTeste: string
  status: string
  duracaoMs: number
  erro?: string
  requestBody?: unknown
  responseBody?: unknown
}

const STATUS_MAP: Record<string, { label: string; cor: string; dot: string }> = {
  ok: { label: 'Online', cor: 'text-green-500', dot: 'bg-green-500' },
  erro: { label: 'Erro', cor: 'text-red-500', dot: 'bg-red-500' },
  sem_resposta: { label: 'Sem resposta', cor: 'text-amber-400', dot: 'bg-amber-400' },
  pendente: { label: 'Testando...', cor: 'text-blue-400', dot: 'bg-blue-400' },
}

function formatMs(ms: number): string {
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

function formatTempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'agora'
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatIntervalo(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function JsonBlock({ data }: { data: unknown }) {
  if (!data) return <span className="text-[var(--text-muted)]">—</span>
  const texto = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return (
    <pre className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
      {texto}
    </pre>
  )
}

export default function TestesPage() {
  const [resultados, setResultados] = useState<BotTestResult[]>([])
  const [config, setConfig] = useState<CronConfig | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [testando, setTestando] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editIntervalo, setEditIntervalo] = useState('')
  const [erro, setErro] = useState('')

  const fetchResultados = useCallback(async () => {
    try {
      const res = await fetch('/api/bot-test/resultados', { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const data = await res.json()
        setResultados(data.resultados || [])
      }
    } catch {}
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/testes/config', { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        setEditIntervalo(String(Math.round(data.pollIntervalMs / 60_000)))
      }
    } catch {}
  }, [])

  useEffect(() => {
    Promise.all([fetchResultados(), fetchConfig()]).finally(() => setCarregando(false))
  }, [fetchResultados, fetchConfig])

  useEffect(() => {
    const interval = setInterval(fetchResultados, 15_000)
    return () => clearInterval(interval)
  }, [fetchResultados])

  const handleTestarBot = async (botId: string) => {
    setTestando(botId)
    setErro('')
    try {
      const res = await fetch('/api/testes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao testar')
      }
      await fetchResultados()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setTestando(null)
    }
  }

  const handleSalvarIntervalo = async () => {
    const min = Number(editIntervalo)
    if (isNaN(min) || min < 15) {
      setErro('Intervalo mínimo: 15 minutos')
      return
    }
    setErro('')
    try {
      const res = await fetch('/api/testes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollIntervalMs: min * 60_000 }),
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  const handleTogglePausar = async () => {
    if (!config) return
    setErro('')
    try {
      const res = await fetch('/api/testes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronPaused: !config.cronPaused }),
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  const stats = {
    total: resultados.length,
    ok: resultados.filter((r) => r.status === 'ok').length,
    erro: resultados.filter((r) => r.status === 'erro').length,
    outros: resultados.filter((r) => r.status !== 'ok' && r.status !== 'erro').length,
  }

  const proximoTeste = config?.lastRunAt && config?.pollIntervalMs && !config.cronPaused
    ? new Date(new Date(config.lastRunAt).getTime() + config.pollIntervalMs)
    : null

  const proximoTesteEm = proximoTeste
    ? Math.max(0, Math.round((proximoTeste.getTime() - Date.now()) / 1000))
    : null

  return (
    <>
      <PageHeader
        titulo="Testes WhatsApp"
        descricao="Testes automatizados via API SendPulse"
        acoes={
          <button
            onClick={() => { fetchResultados(); fetchConfig() }}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {erro && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs text-red-400">
            {erro}
          </div>
        )}

        {/* Configuração do Cron */}
        <section className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Settings size={16} className="text-[var(--d1)]" />
            Configuração do Cron
          </h2>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-muted)]">Intervalo (minutos):</label>
              <input
                type="number"
                min={15}
                value={editIntervalo}
                onChange={(e) => setEditIntervalo(e.target.value)}
                className="w-20 h-8 rounded-md px-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] text-center"
              />
              <button
                onClick={handleSalvarIntervalo}
                className="flex items-center gap-1 px-3 h-8 rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--d1)' }}
              >
                Salvar
              </button>
            </div>

            <button
              onClick={handleTogglePausar}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border transition-colors ${
                config?.cronPaused
                  ? 'text-green-500 border-green-500/30 bg-green-500/10 hover:bg-green-500/20'
                  : 'text-amber-400 border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20'
              }`}
            >
              {config?.cronPaused ? <Play size={12} /> : <Pause size={12} />}
              {config?.cronPaused ? 'Retomar' : 'Pausar'}
            </button>

            <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
              <Timer size={12} />
              {config?.cronPaused ? (
                <span className="text-amber-400">Cron pausado</span>
              ) : proximoTesteEm !== null ? (
                <span>Próximo teste em {proximoTesteEm < 60 ? `${proximoTesteEm}s` : `${Math.round(proximoTesteEm / 60)}min`}</span>
              ) : config ? (
                <span>Intervalo: {formatIntervalo(config.pollIntervalMs)}</span>
              ) : null}
              {config?.lastRunAt && (
                <span className="text-[var(--text-muted)]">· Último: {formatTempoRelativo(config.lastRunAt)}</span>
              )}
            </div>
          </div>
        </section>

        {/* Grid de Status dos Bots */}
        <section className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Zap size={16} className="text-[var(--d1)]" />
            Status dos Bots
          </h2>
          {carregando ? (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-4">
              <RefreshCw size={12} className="animate-spin" />
              Carregando...
            </div>
          ) : resultados.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-4">
              Nenhum teste realizado ainda. Clique em um bot abaixo para testar.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {resultados.map((r) => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.pendente
                const testandoEste = testando === r.botId
                return (
                  <div
                    key={r.botId}
                    className="flex items-center gap-2 rounded-md p-2.5 bg-[var(--bg-surface)] border border-[var(--border)] group"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">{r.nome}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-medium ${st.cor}`}>{st.label}</span>
                        {r.ultimoTeste && (
                          <span className="text-[10px] text-[var(--text-muted)]">{formatTempoRelativo(r.ultimoTeste)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleTestarBot(r.botId)}
                      disabled={testandoEste || !!testando}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-elevated)] disabled:opacity-30"
                      title="Testar agora"
                    >
                      {testandoEste ? (
                        <RefreshCw size={12} className="animate-spin text-[var(--text-muted)]" />
                      ) : (
                        <Send size={12} className="text-[var(--text-muted)]" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Total</div>
          </div>
          <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.ok}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Online</div>
          </div>
          <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.erro}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Erros</div>
          </div>
          <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.outros}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Outros</div>
          </div>
        </div>

        {/* Histórico */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Clock size={16} className="text-[var(--d1)]" />
            Histórico de Testes
          </h2>
          {resultados.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-8">
              Nenhum teste realizado ainda.
            </div>
          ) : (
            <div className="space-y-1.5">
              {resultados.map((r) => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.pendente
                const expandido = expandedId === r.botId
                return (
                  <div
                    key={r.botId}
                    className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(expandido ? null : r.botId)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--glass-hover-bg)] transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                      <span className="text-xs font-medium text-[var(--text-primary)] min-w-[100px]">{r.nome}</span>
                      <span className={`text-xs font-semibold ${st.cor}`}>{st.label}</span>
                      <span className="text-xs text-[var(--text-muted)]">{formatMs(r.duracaoMs)}</span>
                      <span className="text-xs text-[var(--text-muted)]">{formatTempoRelativo(r.ultimoTeste)}</span>
                      {r.erro && (
                        <span className="text-[10px] text-red-400 truncate max-w-[200px]">{r.erro}</span>
                      )}
                      <div className="flex-1" />
                      {expandido ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                    </button>

                    {expandido && (
                      <div className="border-t border-[var(--border)] p-3 space-y-3 bg-[var(--bg-base)]">
                        <div>
                          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">Request</div>
                          <JsonBlock data={r.requestBody} />
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">Response</div>
                          <JsonBlock data={r.responseBody} />
                        </div>
                        {r.erro && (
                          <div>
                            <div className="text-[10px] font-semibold text-red-400 uppercase mb-1">Erro</div>
                            <div className="text-xs text-red-400">{r.erro}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
