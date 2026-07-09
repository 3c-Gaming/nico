'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Send, AlertTriangle, CheckCircle, XCircle, Clock, Smartphone, Link, Camera, MessageSquare, Radio } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import type { TestStatus } from '@/lib/testes/types'

interface BridgeStatus {
  connected: boolean
  number?: string
  qrNeeded: boolean
  lastDisconnectReason?: string
}

interface TestResultItem {
  id: string
  botId: string
  status: TestStatus
  mensagemEnviada: string
  respostaRecebida?: string
  linksEncontrados?: string[]
  linksVerificados?: { url: string; statusCode?: number; utms: Record<string, string> }[]
  duracaoMs: number
  criadoEm: string
  erro?: string
}

interface BotOption {
  id: string
  nome: string
  numero: string
}

const STATUS_LABELS: Record<TestStatus, { label: string; cor: string }> = {
  pending: { label: 'Pendente', cor: 'text-amber-400' },
  aguardando_resposta: { label: 'Aguardando resposta', cor: 'text-blue-400' },
  ok: { label: 'OK', cor: 'text-green-500' },
  sem_resposta: { label: 'Sem resposta', cor: 'text-red-400' },
  copy_incorreta: { label: 'Copy incorreta', cor: 'text-orange-500' },
  link_quebrado: { label: 'Link quebrado', cor: 'text-red-500' },
  erro: { label: 'Erro', cor: 'text-red-600' },
}

export default function TestesPage() {
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [qrPolling, setQrPolling] = useState(false)
  const [testes, setTestes] = useState<TestResultItem[]>([])
  const [bots, setBots] = useState<BotOption[]>([])
  const [selectedBot, setSelectedBot] = useState('')
  const [mensagem, setMensagem] = useState('Olá')
  const [testando, setTestando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [manualNumero, setManualNumero] = useState('')
  const [manualMsg, setManualMsg] = useState('')
  const [manualEnviando, setManualEnviando] = useState(false)
  const [manualResultado, setManualResultado] = useState('')
  const [botTestResults, setBotTestResults] = useState<{ botId: string; nome: string; status: string; ultimoTeste: string; duracaoMs: number }[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/testes/status', { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        return data
      }
    } catch {
      setStatus(null)
    }
    return null
  }, [])

  const pollQr = useCallback(async () => {
    try {
      const res = await fetch('/api/testes/qr', { signal: AbortSignal.timeout(8000) })
      const html = await res.text()
      const qrMatch = html.match(/src="([^"]+base64[^"]+)"/)
      if (qrMatch) {
        setQrSrc(qrMatch[1])
        setQrPolling(false)
      } else if (html.includes('Conectado')) {
        setStatus((prev) => prev ? { ...prev, connected: true } : null)
      }
    } catch {}
  }, [])

  const fetchTestes = useCallback(async () => {
    try {
      const res = await fetch('/api/testes', { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        setTestes(data.testes || [])
      }
    } catch {}
  }, [])

  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch('/api/sendpulse/numeros', { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        setBots(
          (data.numeros || []).map((n: { id: string; nome: string; numero: string }) => ({
            id: n.id,
            nome: n.nome,
            numero: n.numero,
          }))
        )
      }
    } catch {}
  }, [])

  const fetchBotTest = useCallback(async () => {
    try {
      const res = await fetch('/api/bot-test/resultados', { signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        const data = await res.json()
        setBotTestResults(data.resultados || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    Promise.all([fetchStatus(), fetchTestes(), fetchBots(), fetchBotTest()]).finally(() => setCarregando(false))
  }, [fetchStatus, fetchTestes, fetchBots, fetchBotTest])

  useEffect(() => {
    const interval = setInterval(fetchBotTest, 30_000)
    return () => clearInterval(interval)
  }, [fetchBotTest])

  useEffect(() => {
    if (status && !status.connected && !qrSrc) {
      setQrPolling(true)
      pollRef.current = setInterval(pollQr, 3000)
      pollQr()
    }
    if (status?.connected || (status && qrSrc)) {
      setQrPolling(false)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status?.connected, qrSrc, pollQr])

  const handleTestar = async () => {
    if (!selectedBot) return
    setTestando(true)
    setErro('')
    try {
      const res = await fetch('/api/testes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: selectedBot, mensagem }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao iniciar teste')
      }
      await fetchTestes()
      setMensagem('Olá')
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setTestando(false)
    }
  }

  const handleManualEnviar = async () => {
    if (!manualNumero) return
    setManualEnviando(true)
    setManualResultado('')
    try {
      const res = await fetch('/api/testes/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: manualNumero, text: manualMsg || 'Olá' }),
      })
      const data = await res.json()
      setManualResultado(data.success ? '✓ Enviado' : '✗ ' + (data.error || 'Erro'))
      if (data.success) setManualMsg('')
    } catch (err) {
      setManualResultado('✗ ' + (err as Error).message)
    } finally {
      setManualEnviando(false)
    }
  }

  function formatTempo(ms: number) {
    if (ms < 1000) return ms + 'ms'
    return (ms / 1000).toFixed(1) + 's'
  }

  function formatTempoRelativo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60000) return 'agora'
    if (diff < 3600000) return `há ${Math.floor(diff / 60000)}min`
    if (diff < 86400000) return `há ${Math.floor(diff / 3600000)}h`
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const stats = {
    total: testes.length,
    ok: testes.filter((t) => t.status === 'ok').length,
    falha: testes.filter((t) => t.status !== 'ok' && t.status !== 'pending' && t.status !== 'aguardando_resposta').length,
    pendente: testes.filter((t) => t.status === 'pending' || t.status === 'aguardando_resposta').length,
  }

  return (
    <>
      <PageHeader
        titulo="Testes WhatsApp"
        descricao="Testes automatizados de funis via Baileys"
        acoes={
          <button
            onClick={() => { fetchStatus(); fetchTestes() }}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status do Bridge */}
        <section className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Smartphone size={16} className="text-[var(--d1)]" />
            Status da Conexão WhatsApp
          </h2>
          {carregando ? (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <RefreshCw size={12} className="animate-spin" />
              Verificando...
            </div>
          ) : !status ? (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <XCircle size={12} />
              Bridge offline
            </div>
          ) : status.connected ? (
            <div className="flex items-center gap-2 text-xs text-green-500">
              <CheckCircle size={12} />
              Conectado como {status.number}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertTriangle size={12} />
                Aguardando conexão — escaneie o QR code abaixo com o WhatsApp
              </div>
              {qrSrc ? (
                <div className="bg-white inline-block rounded-lg p-2">
                  <img src={qrSrc} style={{ width: 256, height: 256, imageRendering: 'pixelated' }} alt="QR Code" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <RefreshCw size={12} className={qrPolling ? 'animate-spin' : ''} />
                  {qrPolling ? 'Aguardando QR code...' : 'Bridge offline'}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Status dos Bots (Bot-Test) */}
        <section className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Radio size={16} className="text-[var(--d1)]" />
            Status dos Bots
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {botTestResults.map((r) => {
              const isOk = r.status === 'ok'
              const isPendente = r.status === 'pendente'
              const statusCor = isOk ? 'text-green-500' : isPendente ? 'text-amber-400' : 'text-red-400'
              const statusLabel = isOk ? 'Online' : isPendente ? 'Testando...' : 'Offline'
              const diff = Date.now() - new Date(r.ultimoTeste).getTime()
              const haQuanto = diff < 120_000 ? 'agora' : `há ${Math.floor(diff / 60000)}min`
              return (
                <div
                  key={r.botId}
                  className="flex items-center gap-3 rounded-md p-3 bg-[var(--bg-surface)] border border-[var(--border)]"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isOk ? 'bg-green-500' : isPendente ? 'bg-amber-400' : 'bg-red-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">{r.nome}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium ${statusCor}`}>{statusLabel}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{haQuanto}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {botTestResults.length === 0 && (
              <div className="col-span-3 text-xs text-[var(--text-muted)] text-center py-4">
                Nenhum resultado ainda. O primeiro teste roda em até 60s.
              </div>
            )}
          </div>
        </section>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Total</div>
          </div>
          <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.ok}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">OK</div>
          </div>
          <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.falha}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Falhas</div>
          </div>
          <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.pendente}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Pendentes</div>
          </div>
        </div>

        {/* Formulário de teste */}
        <section className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Send size={16} className="text-[var(--d1)]" />
            Novo Teste
          </h2>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Bot</label>
              <select
                value={selectedBot}
                onChange={(e) => setSelectedBot(e.target.value)}
                className="w-full h-9 rounded-md px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)]"
              >
                <option value="">Selecione um bot...</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.nome} ({bot.numero})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Mensagem inicial</label>
              <input
                type="text"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="w-full h-9 rounded-md px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>
            <button
              onClick={handleTestar}
              disabled={!selectedBot || testando}
              className="flex items-center gap-1.5 px-4 h-9 rounded-md text-xs font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--d1)' }}
            >
              {testando ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Testar
                </>
              )}
            </button>
          </div>
          {erro && (
            <div className="flex items-center gap-2 mt-3 text-xs text-red-400">
              <AlertTriangle size={12} />
              {erro}
            </div>
          )}
        </section>

        {/* Envio Manual */}
        <section className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <MessageSquare size={16} className="text-[var(--d1)]" />
            Envio Manual
          </h2>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Número (com DDD, ex: 5511999999999)</label>
              <input
                type="text"
                value={manualNumero}
                onChange={(e) => setManualNumero(e.target.value)}
                placeholder="5511999999999"
                className="w-full h-9 rounded-md px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Mensagem</label>
              <input
                type="text"
                value={manualMsg}
                onChange={(e) => setManualMsg(e.target.value)}
                placeholder="Olá"
                className="w-full h-9 rounded-md px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>
            <button
              onClick={handleManualEnviar}
              disabled={!manualNumero || manualEnviando}
              className="flex items-center gap-1.5 px-4 h-9 rounded-md text-xs font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--d1)' }}
            >
              {manualEnviando ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Enviar
                </>
              )}
            </button>
          </div>
          {manualResultado && (
            <div className={`text-xs mt-2 ${manualResultado.startsWith('✓') ? 'text-green-500' : 'text-red-400'}`}>
              {manualResultado}
            </div>
          )}
        </section>

        {/* Histórico */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Clock size={16} className="text-[var(--d1)]" />
            Histórico de Testes
          </h2>
          {testes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Camera size={32} className="text-[var(--text-muted)]/20 mb-3" />
              <p className="text-sm text-[var(--text-muted)]">Nenhum teste realizado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {testes.slice(0, 50).map((t) => {
                const st = STATUS_LABELS[t.status]
                return (
                  <div
                    key={t.id}
                    className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3 hover:bg-[var(--glass-hover-bg)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${st.cor}`}>{st.label}</span>
                          <span className="text-xs text-[var(--text-muted)] font-mono">{t.botId}</span>
                          <span className="text-xs text-[var(--text-muted)]">{formatTempo(t.duracaoMs)}</span>
                          <span className="text-xs text-[var(--text-muted)]">{formatTempoRelativo(t.criadoEm)}</span>
                        </div>
                        <div className="text-xs text-[var(--text-primary)]">
                          Enviado: {t.mensagemEnviada}
                        </div>
                        {t.respostaRecebida && (
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                            Resposta: {t.respostaRecebida.slice(0, 150)}
                            {t.respostaRecebida.length > 150 ? '...' : ''}
                          </div>
                        )}
                        {t.linksEncontrados && t.linksEncontrados.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Link size={10} className="text-[var(--text-muted)]" />
                            {t.linksEncontrados.map((link, i) => (
                              <span key={i} className="text-[10px] text-blue-400 truncate max-w-[200px]">
                                {link}
                              </span>
                            ))}
                          </div>
                        )}
                        {t.erro && (
                          <div className="text-xs text-red-400 mt-0.5">{t.erro}</div>
                        )}
                      </div>
                    </div>
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
