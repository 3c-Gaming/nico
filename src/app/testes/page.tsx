'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { RefreshCw, Send, Check, Copy, Clock, Settings, ChevronDown, ChevronUp, Zap, Save, Ticket, ExternalLink, X, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/ui/Modal'

interface CronConfig {
  pollIntervalMs: number
  cronPaused: boolean
  lastRunAt: string | null
  botContactIds: Record<string, string>
  bots: { botId: string; nome: string; numero: string; contaNome?: string }[]
}

interface BettingLink {
  id: string
  casa: string
  dataJogo: string
  horarioJogo: string
  link: string
  ativo: boolean
  criadoEm: string
}

interface BilheteResultado {
  casa: string
  bilhetes: BettingLink[]
  erro: string | null
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

function formatUltimosQuatro(numero: string): string {
  return numero.replace(/\D/g, '').slice(-4)
}

function formatDataJogo(dataJogo: string, horarioJogo: string): string {
  const [, mes, dia] = dataJogo.split('-')
  const hora = horarioJogo.slice(0, 5)
  return dia && mes ? `${dia}/${mes} ${hora}` : `${dataJogo} ${hora}`
}

/** Aceita tanto o curl inteiro (copiado do exemplo da SendPulse/Supabase) quanto só o valor da
 * casa digitado direto — o que muda de um bilhete pra outro é sempre o "casa=eq.<valor>" na URL,
 * então basta procurar por esse pedaço; se não achar, assume que o texto inteiro já É o valor da
 * casa (uso digitando direto, sem colar curl nenhum). */
function extrairCasaDoCurl(texto: string): string {
  const match = texto.match(/casa=eq\.([^&\s'"]+)/)
  if (match) return decodeURIComponent(match[1])
  return texto.trim()
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
  const [erro, setErro] = useState('')
  const [editBotContactIds, setEditBotContactIds] = useState<Record<string, string>>({})
  const [salvandoBotId, setSalvandoBotId] = useState<string | null>(null)
  const [botIdCopiado, setBotIdCopiado] = useState<string | null>(null)
  const [bilheteResultados, setBilheteResultados] = useState<BilheteResultado[]>([])
  const [carregandoBilhetes, setCarregandoBilhetes] = useState(true)
  const [novoCurl, setNovoCurl] = useState('')
  const [salvandoCasa, setSalvandoCasa] = useState(false)
  const [modalCasaAberto, setModalCasaAberto] = useState(false)
  const [removendoCasa, setRemovendoCasa] = useState<string | null>(null)
  const [erroBilhetes, setErroBilhetes] = useState('')
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)

  const fetchResultados = useCallback(async () => {
    try {
      const res = await fetch('/api/bot-test/resultados', { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const data = await res.json()
        setResultados(data.resultados || [])
      }
    } catch { }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/testes/config', { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        setEditBotContactIds(data.botContactIds ?? {})
      }
    } catch { }
  }, [])

  const fetchBilhetes = useCallback(async () => {
    try {
      const res = await fetch('/api/betting-links/status', { signal: AbortSignal.timeout(15000) })
      if (res.ok) {
        const data = await res.json()
        setBilheteResultados(data.resultados ?? [])
      }
    } catch { }
  }, [])

  useEffect(() => {
    Promise.all([fetchResultados(), fetchConfig()]).finally(() => setCarregando(false))
    fetchBilhetes().finally(() => setCarregandoBilhetes(false))
  }, [fetchResultados, fetchConfig, fetchBilhetes])

  useEffect(() => {
    const interval = setInterval(fetchResultados, 15_000)
    return () => clearInterval(interval)
  }, [fetchResultados])

  const handleAdicionarCasa = async () => {
    const casa = extrairCasaDoCurl(novoCurl)
    if (!casa) return
    setSalvandoCasa(true)
    setErroBilhetes('')
    try {
      const casasAtuais = bilheteResultados.map((r) => r.casa)
      const res = await fetch('/api/betting-links/casas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casas: [...casasAtuais, casa] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar casa')
      setNovoCurl('')
      setModalCasaAberto(false)
      await fetchBilhetes()
    } catch (err) {
      setErroBilhetes((err as Error).message)
    } finally {
      setSalvandoCasa(false)
    }
  }

  const handleRemoverCasa = async (casa: string) => {
    setRemovendoCasa(casa)
    setErroBilhetes('')
    try {
      const casasAtuais = bilheteResultados.map((r) => r.casa).filter((c) => c !== casa)
      const res = await fetch('/api/betting-links/casas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casas: casasAtuais }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao remover casa')
      await fetchBilhetes()
    } catch (err) {
      setErroBilhetes((err as Error).message)
    } finally {
      setRemovendoCasa(null)
    }
  }

  const handleCopiarLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setLinkCopiado(link)
      window.setTimeout(() => setLinkCopiado(null), 1500)
    } catch {
      setErroBilhetes('Não foi possível copiar o link')
    }
  }

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

  const handleSalvarContactId = async (botId: string) => {
    setSalvandoBotId(botId)
    setErro('')
    try {
      const res = await fetch('/api/testes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, botContactId: editBotContactIds[botId] ?? '' }),
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar contact_id')
      }
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvandoBotId(null)
    }
  }

  const handleCopiarBotId = async (botId: string) => {
    try {
      await navigator.clipboard.writeText(botId)
      setBotIdCopiado(botId)
      window.setTimeout(() => setBotIdCopiado(null), 1500)
    } catch {
      setErro('Não foi possível copiar o bot ID')
    }
  }

  // O backend só devolve em config.bots os números ativos — usa isso como filtro
  // pra esconder resultados/histórico de números inativos nesta página.
  const botIdsAtivos = new Set((config?.bots ?? []).map((b) => b.botId))
  const resultadosAtivos = resultados.filter((r) => botIdsAtivos.has(r.botId))

  // Mesmo bot_id nunca se repete entre contas SendPulse diferentes — mapa auxiliar pra achar de
  // qual conta cada resultado/histórico veio sem precisar cruzar de novo com a lista de bots.
  const contaNomePorBot = new Map((config?.bots ?? []).map((b) => [b.botId, b.contaNome]))

  const stats = {
    total: resultadosAtivos.length,
    ok: resultadosAtivos.filter((r) => r.status === 'ok').length,
    erro: resultadosAtivos.filter((r) => r.status === 'erro').length,
    outros: resultadosAtivos.filter((r) => r.status !== 'ok' && r.status !== 'erro').length,
  }

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

        {/* Contact IDs dos Bots */}
        <section className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-3">
            <Settings size={16} className="text-[var(--d1)]" />
            Contact IDs dos Bots
          </h2>
          <p className="text-[12px] mb-3">
            Interaja com os números e resgate seu contact_id para cada bot. Insira o contact_id no campo abaixo e clique em &quot;Salvar&quot;.
          </p>
          <div className={`grid gap-2 ${(config?.bots.length ?? 0) % 2 === 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {(config?.bots ?? []).map((bot) => (
              <div key={bot.botId} className="relative flex flex-col gap-1 rounded-md p-2 bg-[var(--bg-surface)] border border-[var(--border)]">
                <div onClick={() => handleCopiarBotId(bot.botId)} className="absolute top-2 right-2 flex items-center gap-1 max-w-[55%] cursor-pointer select-none hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] ">
                  <span className="text-[12px] font-mono truncate" title={bot.botId}>{bot.botId}</span>
                  <button
                    type="button"
                    className="shrink-0 p-1 rounded cursor-pointer transition-colors"
                    title={botIdCopiado === bot.botId ? 'Copiado' : 'Copiar bot ID'}
                    aria-label={botIdCopiado === bot.botId ? 'Bot ID copiado' : 'Copiar bot ID'}
                  >
                    {botIdCopiado === bot.botId ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <div className="flex items-center px-5 gap-2 flex-wrap">
                  <Image
                    src={"/PILHADO.jpg"}
                    alt={bot.nome}
                    width={55}
                    height={55}
                    className="rounded-full object-cover border-2 border-green-500 shadow-2xl"
                  />
                  <div className="grid grid-cols-1 gap-1 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-md font-semibold">{bot.nome}</span>
                      {bot.contaNome && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]">
                          {bot.contaNome}
                        </span>
                      )}
                    </div>
                    <span className="text-[14px] font-mono truncate" title="Últimos 4 dígitos do telefone">
                      FINAL {formatUltimosQuatro(bot.numero)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 m-2">
                  <input
                    type="text"
                    value={editBotContactIds[bot.botId] ?? ''}
                    onChange={(e) => setEditBotContactIds((prev) => ({ ...prev, [bot.botId]: e.target.value }))}
                    placeholder="CONTACT_ID DE TESTES"
                    className="h-10 min-w-0 flex-1 rounded-md px-2 text-[12px] font-mono bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleSalvarContactId(bot.botId)}
                    disabled={salvandoBotId !== null}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 h-8 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--d1)' }}
                    title="Salvar contact_id"
                  >
                    {salvandoBotId === bot.botId ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                    Salvar
                  </button>
                </div>
              </div>
            ))}
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
          ) : resultadosAtivos.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-4">
              Nenhum teste realizado ainda. Clique em um bot abaixo para testar.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {resultadosAtivos.map((r) => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.pendente
                const testandoEste = testando === r.botId
                return (
                  <div
                    key={r.botId}
                    className="flex items-center gap-2 rounded-md p-2.5 bg-[var(--bg-surface)] border border-[var(--border)] group"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-[var(--text-primary)] truncate">{r.nome}</span>
                        {contaNomePorBot.get(r.botId) && (
                          <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]">
                            {contaNomePorBot.get(r.botId)}
                          </span>
                        )}
                      </div>
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

        {/* Bilhetes de Aposta Pronta */}
        <section className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Ticket size={16} className="text-[var(--d1)]" />
              Bilhetes de Aposta Pronta
            </h2>
            <button
              onClick={() => { setCarregandoBilhetes(true); fetchBilhetes().finally(() => setCarregandoBilhetes(false)) }}
              disabled={carregandoBilhetes}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={carregandoBilhetes ? 'animate-spin' : ''} />
              Recarregar
            </button>
          </div>
          <p className="text-[12px] mb-3">
            Consulta ao vivo (GET betting_links) por casa — mostra o bilhete mais recente ainda ativo de cada uma.
          </p>

          {erroBilhetes && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-3" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
              {erroBilhetes}
            </div>
          )}

          <button
            onClick={() => setModalCasaAberto(true)}
            className="flex items-center gap-1.5 rounded-md px-2.5 h-8 text-xs font-medium text-white transition-opacity hover:opacity-90 mb-3"
            style={{ backgroundColor: 'var(--d1)' }}
          >
            <Plus size={12} />
            Adicionar casa
          </button>

          {carregandoBilhetes ? (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-4">
              <RefreshCw size={12} className="animate-spin" />
              Carregando...
            </div>
          ) : bilheteResultados.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-4">
              Nenhuma casa configurada ainda — adicione uma acima.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left py-1.5 px-2 font-medium text-[var(--text-muted)]">Casa</th>
                    <th className="text-left py-1.5 px-2 font-medium text-[var(--text-muted)]">Data jogo</th>
                    <th className="text-left py-1.5 px-2 font-medium text-[var(--text-muted)]">Link</th>
                    <th className="text-left py-1.5 px-2 font-medium text-[var(--text-muted)]">Criado</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {bilheteResultados.map((r) => {
                    const bilhete = r.bilhetes[0]
                    return (
                      <tr key={r.casa} className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors group">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${r.erro ? 'bg-red-500' : bilhete ? 'bg-green-500' : 'bg-[var(--text-muted)]'}`} />
                            <span className="font-mono font-medium text-[var(--text-primary)]" title={r.casa}>{r.casa}</span>
                          </div>
                        </td>
                        {r.erro ? (
                          <td colSpan={3} className="py-2 px-2 text-red-400">{r.erro}</td>
                        ) : bilhete ? (
                          <>
                            <td className="py-2 px-2 text-[var(--text-secondary)] whitespace-nowrap">{formatDataJogo(bilhete.dataJogo, bilhete.horarioJogo)}</td>
                            <td className="py-2 px-2 max-w-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <a
                                  href={bilhete.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[var(--d1)] hover:underline truncate min-w-0"
                                >
                                  <ExternalLink size={11} className="shrink-0" />
                                  <span className="truncate">{bilhete.link}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopiarLink(bilhete.link)}
                                  className="shrink-0 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                                  title={linkCopiado === bilhete.link ? 'Copiado' : 'Copiar link'}
                                >
                                  {linkCopiado === bilhete.link ? <Check size={11} /> : <Copy size={11} />}
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-[var(--text-muted)] whitespace-nowrap">{formatTempoRelativo(bilhete.criadoEm)}</td>
                          </>
                        ) : (
                          <td colSpan={3} className="py-2 px-2 text-[var(--text-muted)]">Sem bilhete ativo</td>
                        )}
                        <td className="py-2 px-2">
                          <button
                            onClick={() => handleRemoverCasa(r.casa)}
                            disabled={removendoCasa !== null}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-elevated)] disabled:opacity-30"
                            title="Parar de monitorar essa casa"
                          >
                            {removendoCasa === r.casa ? (
                              <RefreshCw size={12} className="animate-spin text-[var(--text-muted)]" />
                            ) : (
                              <X size={12} className="text-[var(--text-muted)]" />
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Modal open={modalCasaAberto} onClose={() => setModalCasaAberto(false)} title="Adicionar casa">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Curl inteiro ou só o valor da casa</label>
              <textarea
                value={novoCurl}
                onChange={(e) => setNovoCurl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdicionarCasa() }}
                placeholder={"Cole o curl inteiro (ex: da SendPulse/Supabase) ou só o valor da casa, ex: superbet_odm"}
                rows={5}
                autoFocus
                className="w-full px-2 py-1.5 text-xs font-mono bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors resize-y"
              />
            </div>
            {erroBilhetes && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
                {erroBilhetes}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setModalCasaAberto(false)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdicionarCasa}
                disabled={salvandoCasa || !extrairCasaDoCurl(novoCurl)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--d1)' }}
              >
                {salvandoCasa ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                Adicionar
              </button>
            </div>
          </div>
        </Modal>

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
          {resultadosAtivos.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-8">
              Nenhum teste realizado ainda.
            </div>
          ) : (
            <div className="space-y-1.5">
              {resultadosAtivos.map((r) => {
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
                      {contaNomePorBot.get(r.botId) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]">
                          {contaNomePorBot.get(r.botId)}
                        </span>
                      )}
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
