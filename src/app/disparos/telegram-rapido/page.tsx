'use client'

import { useEffect, useMemo, useState } from 'react'
import { Upload, Send, Save, BookmarkPlus, CalendarClock, Search, Tag as TagIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useDisparos } from '@/hooks/useDisparos'
import type { Disparo } from '@/types'

function getLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getLocalHora(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface LinhaBase {
  username: string
  /** Só existe quando a base veio de uma tag da SendPulse (não de CSV) — nesse caso já pula
   * direto pro envio, sem precisar casar por username (nem todo contato tem um público). */
  telegramId?: number
  variables: Record<string, string>
}

interface TagSendpulse {
  id: string
  nome: string
  contagem: number
}

interface ResultadoEnvio {
  username: string
  ok: boolean
  erro?: string
}

interface TelegramTemplate {
  id: string
  nome: string
  corpo: string
}

interface BotTelegram {
  id: string
  numero: string
  nome: string
}

function CopyComTags({ texto, variaveisConhecidas }: { texto: string; variaveisConhecidas: string[] }) {
  const partes = texto.split(/(\{\{[^}]*\}\})/g).filter((p) => p !== '')
  if (!texto) return <span className="text-[var(--text-muted)] italic">nada escrito ainda...</span>
  return (
    <>
      {partes.map((parte, i) => {
        const m = parte.match(/^\{\{([^}]*)\}\}$/)
        if (!m) return <span key={i}>{parte}</span>
        const nomeVar = m[1].trim()
        const reconhecida = variaveisConhecidas.includes(nomeVar)
        return (
          <span
            key={i}
            className={`px-1 rounded font-mono ${reconhecida ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}
            title={reconhecida ? 'Variável reconhecida — existe como coluna na base carregada' : 'Essa variável não bate com nenhuma coluna da base — vai ser enviada em branco'}
          >
            {parte}
          </span>
        )
      })}
    </>
  )
}

function resolverExemplo(texto: string, variables: Record<string, string>): string {
  return texto.replace(/\{\{([^}]*)\}\}/g, (match, nome) => variables[nome.trim()] ?? match)
}

const COLUNAS_USERNAME = ['username', 'user', 'usuario', '@', 'handle', 'telegram']

function parsearCsv(texto: string): { headers: string[]; linhas: string[][] } {
  const linhasBrutas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  function parseLinha(linha: string): string[] {
    const campos: string[] = []
    let atual = ''
    let dentroAspas = false
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i]
      if (c === '"') {
        dentroAspas = !dentroAspas
      } else if (c === ',' && !dentroAspas) {
        campos.push(atual.trim())
        atual = ''
      } else {
        atual += c
      }
    }
    campos.push(atual.trim())
    return campos
  }
  const [headerLinha, ...resto] = linhasBrutas
  return { headers: parseLinha(headerLinha), linhas: resto.map(parseLinha) }
}

export default function TelegramRapidoPage() {
  const { addToast } = useToast()
  const { create: createDisparo } = useDisparos()

  const [campanha, setCampanha] = useState(() => `telegram-${new Date().toISOString().slice(0, 10)}`)
  const [corpo, setCorpo] = useState('')

  const [bots, setBots] = useState<BotTelegram[]>([])
  const [botSelecionado, setBotSelecionado] = useState('')

  const [fonte, setFonte] = useState<'csv' | 'tag'>('csv')
  const [tags, setTags] = useState<TagSendpulse[]>([])
  const [carregandoTags, setCarregandoTags] = useState(false)
  const [tagSelecionada, setTagSelecionada] = useState('')
  const [carregandoContatosTag, setCarregandoContatosTag] = useState(false)

  const [agendar, setAgendar] = useState(false)
  const [dataAgendada, setDataAgendada] = useState(() => getLocalDate())
  const [horarioAgendado, setHorarioAgendado] = useState('')

  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [colunaUsername, setColunaUsername] = useState<string>('')
  const [linhas, setLinhas] = useState<LinhaBase[]>([])
  const [linhasCruas, setLinhasCruas] = useState<string[][]>([])

  const [resolvendo, setResolvendo] = useState(false)
  const [matchInfo, setMatchInfo] = useState<{ total: number; encontrados: number; naoEncontrados: number; assinatura: string } | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null)

  const [templates, setTemplates] = useState<TelegramTemplate[]>([])
  const [templateSelecionadoId, setTemplateSelecionadoId] = useState('')
  const [mostrarSalvarTemplate, setMostrarSalvarTemplate] = useState(false)
  const [nomeNovoTemplate, setNomeNovoTemplate] = useState('')
  const [salvandoTemplate, setSalvandoTemplate] = useState(false)

  useEffect(() => {
    fetch('/api/sendpulse/numeros?canal=telegram')
      .then((r) => r.json())
      .then((data) => setBots(data.numeros ?? []))
      .catch(() => {})
    fetch('/api/telegram/templates')
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => {})
  }, [])

  // Assinatura do que o preview de match foi calculado em cima — se a base ou o bot mudarem
  // depois, o preview guardado fica "velho" e some (calculado no render, não via effect
  // separado, pra não precisar de um setState só pra invalidar estado).
  const assinaturaAtual = `${botSelecionado}|${linhas.length}|${linhas.map((l) => l.username).join(',')}`
  const matchInfoValido = matchInfo && matchInfo.assinatura === assinaturaAtual ? matchInfo : null

  function handleCarregarTemplate(id: string) {
    setTemplateSelecionadoId(id)
    const template = templates.find((t) => t.id === id)
    if (template) setCorpo(template.corpo)
  }

  async function handleSalvarTemplate() {
    if (!nomeNovoTemplate.trim() || !corpo.trim()) return
    setSalvandoTemplate(true)
    try {
      const res = await fetch('/api/telegram/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeNovoTemplate.trim(), corpo }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTemplates((prev) => [data.template, ...prev])
      setTemplateSelecionadoId(data.template.id)
      setMostrarSalvarTemplate(false)
      setNomeNovoTemplate('')
      addToast('success', 'Template salvo')
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setSalvandoTemplate(false)
    }
  }

  function recalcularLinhas(hdrs: string[], cruas: string[][], colUsername: string) {
    const idx = hdrs.indexOf(colUsername)
    if (idx === -1) { setLinhas([]); return }
    const novas = cruas.map((campos) => {
      const variables: Record<string, string> = {}
      hdrs.forEach((h, i) => { if (i !== idx) variables[h] = campos[i] ?? '' })
      return { username: (campos[idx] ?? '').replace(/^@/, ''), variables }
    }).filter((l) => l.username)
    setLinhas(novas)
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNomeArquivo(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const texto = String(reader.result ?? '')
      const { headers: hdrs, linhas: cruas } = parsearCsv(texto)
      setHeaders(hdrs)
      setLinhasCruas(cruas)
      const auto = hdrs.find((h) => COLUNAS_USERNAME.includes(h.toLowerCase())) ?? hdrs[0] ?? ''
      setColunaUsername(auto)
      recalcularLinhas(hdrs, cruas, auto)
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleColunaUsername(col: string) {
    setColunaUsername(col)
    recalcularLinhas(headers, linhasCruas, col)
  }

  function inserirVariavel(nome: string) {
    setCorpo((prev) => `${prev}{{${nome}}}`)
  }

  const variaveisDisponiveis = useMemo(
    () => headers.filter((h) => h !== colunaUsername),
    [headers, colunaUsername],
  )

  async function carregarTags(bot: string) {
    if (!bot) { setTags([]); return }
    setCarregandoTags(true)
    try {
      const res = await fetch(`/api/telegram/tags?botIdentificador=${encodeURIComponent(bot)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const ordenadas = [...(data.tags ?? [])].sort((a: TagSendpulse, b: TagSendpulse) => b.contagem - a.contagem)
      setTags(ordenadas)
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setCarregandoTags(false)
    }
  }

  function handleMudarFonte(nova: 'csv' | 'tag') {
    setFonte(nova)
    setLinhas([])
    setNomeArquivo(null)
    setTagSelecionada('')
    setHeaders([])
    setColunaUsername('')
    if (nova === 'tag' && botSelecionado) carregarTags(botSelecionado)
  }

  function handleMudarBot(bot: string) {
    setBotSelecionado(bot)
    setLinhas([])
    setTagSelecionada('')
    if (fonte === 'tag' && bot) carregarTags(bot)
  }

  async function handleSelecionarTag(tagNome: string) {
    setTagSelecionada(tagNome)
    if (!tagNome || !botSelecionado) { setLinhas([]); return }
    setCarregandoContatosTag(true)
    try {
      const res = await fetch(`/api/telegram/contatos-por-tag?botIdentificador=${encodeURIComponent(botSelecionado)}&tag=${encodeURIComponent(tagNome)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const novasLinhas: LinhaBase[] = (data.contatos ?? []).map((c: { username: string | null; telegramId: number; nome: string }) => ({
        username: c.username ?? '',
        telegramId: c.telegramId,
        variables: { Nome: c.nome },
      }))
      setLinhas(novasLinhas)
      setHeaders(['Nome'])
      setColunaUsername('')
      setNomeArquivo(`tag-${tagNome}`)
      addToast('success', `${data.disponiveis} de ${data.total} contato(s) dessa tag prontos pra receber`)
    } catch (err) {
      addToast('error', (err as Error).message)
      setLinhas([])
    } finally {
      setCarregandoContatosTag(false)
    }
  }

  async function handleVerificarMatch() {
    if (!botSelecionado || linhas.length === 0) return
    setResolvendo(true)
    try {
      const res = await fetch('/api/telegram/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botIdentificador: botSelecionado, usernames: linhas.map((l) => l.username) }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMatchInfo({ total: data.total, encontrados: data.encontrados, naoEncontrados: data.naoEncontrados, assinatura: assinaturaAtual })
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setResolvendo(false)
    }
  }

  const podeEnviar = campanha.trim() && botSelecionado && corpo.trim() && linhas.length > 0 && !enviando
    && (!agendar || !!horarioAgendado)

  async function criarRegistroDisparo(status: 'executado' | 'agendado'): Promise<Disparo | null> {
    const agora = new Date()
    const novoDisparo: Disparo = {
      id: crypto.randomUUID(),
      tipo: 'PONTUAL',
      canal: 'telegram-csv',
      nomenclatura: campanha,
      status,
      casasAposta: [],
      dataDisparo: status === 'agendado' ? dataAgendada : getLocalDate(),
      horarioDisparo: status === 'agendado' ? horarioAgendado : getLocalHora(),
      base: { status: 'disponivel', totalRegistros: linhas.length, nomeArquivo: nomeArquivo ?? undefined },
      telegramCorpo: corpo,
      telegramBotUsername: botSelecionado,
      telegramDestinatarios: linhas,
      criadoEm: agora.toISOString(),
      atualizadoEm: agora.toISOString(),
      notas: `Disparo Telegram via CSV — campanha "${campanha}"`,
    }
    const resDisparo = await fetch('/api/disparos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disparo: novoDisparo }),
    })
    const data = await resDisparo.json()
    if (!data.disparo) return null
    createDisparo(data.disparo)
    return data.disparo
  }

  async function handleEnviar() {
    if (!podeEnviar) return

    if (agendar) {
      const quando = new Date(`${dataAgendada}T${horarioAgendado}:00-03:00`)
      if (quando <= new Date()) { addToast('error', 'Escolha uma data/hora no futuro'); return }
      if (!confirm(`Agendar Telegram pra ${linhas.length} usuário(s) em ${dataAgendada} às ${horarioAgendado}? Vai disparar sozinho nessa hora.`)) return
      setEnviando(true)
      try {
        const disparo = await criarRegistroDisparo('agendado')
        if (disparo) addToast('success', `Agendado pra ${dataAgendada} às ${horarioAgendado} — vai disparar sozinho e aparece em Disparos`)
        else addToast('error', 'Não deu pra agendar')
      } catch (err) {
        addToast('error', (err as Error).message)
      } finally {
        setEnviando(false)
      }
      return
    }

    if (!confirm(`Enviar Telegram pra ${linhas.length} usuário(s) agora? Essa ação é real, não tem como desfazer.`)) return
    setEnviando(true)
    setResultados(null)
    try {
      const res = await fetch('/api/telegram/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha, corpo, botIdentificador: botSelecionado, destinatarios: linhas }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResultados(data.resultados)
      addToast(data.falhas > 0 ? 'warning' : 'success', `${data.enviados} enviado(s), ${data.falhas} falha(s)`)

      try {
        await criarRegistroDisparo('executado')
      } catch {
        addToast('warning', 'Telegram enviado, mas não deu pra criar o registro em Disparos')
      }
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <PageHeader titulo="Disparo Telegram" descricao="Envio direto via Bot API pra uma base externa (CSV de @usernames)" />
      <div className="p-6 space-y-5 max-w-3xl mx-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Nome da campanha</label>
            <input
              value={campanha}
              onChange={(e) => setCampanha(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Bot de Telegram</label>
            <select
              value={botSelecionado}
              onChange={(e) => handleMudarBot(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            >
              <option value="">Selecione...</option>
              {bots.map((b) => <option key={b.id} value={b.numero}>{b.numero} — {b.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-medium text-[var(--text-muted)]">Base</label>
            <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--border)] rounded p-0.5">
              <button
                type="button"
                onClick={() => handleMudarFonte('csv')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${fonte === 'csv' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                CSV externo
              </button>
              <button
                type="button"
                onClick={() => handleMudarFonte('tag')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${fonte === 'tag' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                Tag da SendPulse
              </button>
            </div>
          </div>

          {fonte === 'csv' ? (
            <>
              <label className="flex items-center gap-2 h-10 px-3 border border-dashed border-[var(--border)] rounded-md text-sm text-[var(--text-muted)] cursor-pointer hover:border-[var(--border-strong)] transition-colors w-fit">
                <Upload size={14} />
                {nomeArquivo ?? 'Escolher arquivo CSV...'}
                <input type="file" accept=".csv" onChange={handleArquivo} className="hidden" />
              </label>
              {headers.length > 0 && (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-xs text-[var(--text-muted)]">Coluna do username:</span>
                  <select
                    value={colunaUsername}
                    onChange={(e) => handleColunaUsername(e.target.value)}
                    className="h-7 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                  >
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="text-xs text-[var(--text-muted)]">{linhas.length} usuário(s) válido(s)</span>
                </div>
              )}
              {linhas.length > 0 && botSelecionado && (
                <div className="pt-1">
                  <Button size="sm" variant="secondary" icon={<Search size={12} />} onClick={handleVerificarMatch} loading={resolvendo}>
                    Verificar quantos batem com o bot
                  </Button>
                  {matchInfoValido && (
                    <p className="text-[11px] mt-1.5">
                      <span className="text-emerald-400 font-medium">{matchInfoValido.encontrados} encontrado(s)</span>
                      {' '}/ <span className="text-[var(--error)]">{matchInfoValido.naoEncontrados} não encontrado(s)</span>
                      {' '}de {matchInfoValido.total} — só quem já falou com esse bot E tem @username público no Telegram pode ser alcançado.
                    </p>
                  )}
                </div>
              )}
              <p className="text-[10px] text-[var(--text-muted)]">Só alcança quem tem @username público no Telegram (na prática, uma fração da base) — pra alcançar todo mundo que já falou com o bot, prefira &ldquo;Tag da SendPulse&rdquo;.</p>
            </>
          ) : (
            <>
              {!botSelecionado && <p className="text-[11px] text-amber-400">Selecione um bot primeiro.</p>}
              {botSelecionado && (
                <div className="flex items-center gap-2 flex-wrap">
                  <TagIcon size={13} className="text-[var(--text-muted)]" />
                  <select
                    value={tagSelecionada}
                    onChange={(e) => handleSelecionarTag(e.target.value)}
                    disabled={carregandoTags}
                    className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none min-w-[220px]"
                  >
                    <option value="">{carregandoTags ? 'Carregando tags...' : 'Selecione uma tag...'}</option>
                    {tags.map((t) => <option key={t.id} value={t.nome}>{t.nome} ({t.contagem})</option>)}
                  </select>
                  {carregandoContatosTag && <span className="text-xs text-[var(--text-muted)]">Carregando contatos...</span>}
                  {!carregandoContatosTag && linhas.length > 0 && (
                    <span className="text-xs text-emerald-400">{linhas.length} contato(s) prontos — 100% alcançável, já vem com telegram_id direto da SendPulse</span>
                  )}
                </div>
              )}
              <p className="text-[10px] text-[var(--text-muted)]">Só mostra as 100 tags mais recentes do bot (limite da API da SendPulse).</p>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-medium text-[var(--text-muted)]">Mensagem</label>
            <div className="flex items-center gap-2">
              {templates.length > 0 && (
                <select
                  value={templateSelecionadoId}
                  onChange={(e) => handleCarregarTemplate(e.target.value)}
                  className="h-7 px-2 text-[10px] bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                >
                  <option value="">Carregar template...</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              )}
              <button
                type="button"
                onClick={() => setMostrarSalvarTemplate((v) => !v)}
                disabled={!corpo.trim()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 transition-colors"
              >
                <BookmarkPlus size={11} />
                Salvar como template
              </button>
            </div>
          </div>

          {mostrarSalvarTemplate && (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={nomeNovoTemplate}
                onChange={(e) => setNomeNovoTemplate(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSalvarTemplate()}
                placeholder="Nome do template..."
                className="flex-1 h-7 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)]"
              />
              <Button size="sm" icon={<Save size={12} />} onClick={handleSalvarTemplate} disabled={!nomeNovoTemplate.trim()} loading={salvandoTemplate}>
                Salvar
              </Button>
            </div>
          )}

          {variaveisDisponiveis.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-[var(--text-muted)]">inserir:</span>
              {variaveisDisponiveis.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => inserirVariavel(v)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Oi {{nome}}, essa é exclusiva pra você: {{link}}"
            rows={4}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] resize-none font-mono"
          />
          <p className="text-[10px] text-[var(--text-muted)]">Sem limite de caracteres do SMS, mas mensagens muito longas ficam estranhas no Telegram — capricha no tamanho.</p>

          {corpo && (
            <div className="space-y-2 pt-1">
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
                <p className="text-[10px] font-medium text-[var(--text-muted)] mb-1">
                  Pré-visualização — <span className="text-emerald-400">verde</span> = variável reconhecida na base, <span className="text-red-400">vermelho</span> = não bate com nenhuma coluna
                </p>
                <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
                  <CopyComTags texto={corpo} variaveisConhecidas={variaveisDisponiveis} />
                </p>
              </div>
              {linhas.length > 0 && (
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5">
                  <p className="text-[10px] font-medium text-[var(--text-muted)] mb-1">Exemplo real (1ª linha da base, @{linhas[0].username})</p>
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">{resolverExemplo(corpo, linhas[0].variables)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]">
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer w-fit">
            <input type="checkbox" checked={agendar} onChange={(e) => setAgendar(e.target.checked)} />
            <CalendarClock size={13} className="text-[var(--text-muted)]" />
            Agendar pra depois (em vez de enviar agora)
          </label>
          {agendar && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="date"
                value={dataAgendada}
                onChange={(e) => setDataAgendada(e.target.value)}
                min={getLocalDate()}
                className="h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              />
              <input
                type="time"
                value={horarioAgendado}
                onChange={(e) => setHorarioAgendado(e.target.value)}
                className="h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              />
              <span className="text-[10px] text-[var(--text-muted)]">Base grande sai em lotes de 500 a cada 5min, não tudo de uma vez — acompanhe em Disparos.</span>
            </div>
          )}
        </div>

        {linhas.length > 0 && (
          <div className="rounded-md border border-[var(--border)] overflow-hidden max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                <tr>
                  <th className="text-left px-3 py-1.5 text-[var(--text-muted)]">Username</th>
                  {variaveisDisponiveis.map((v) => <th key={v} className="text-left px-3 py-1.5 text-[var(--text-muted)]">{v}</th>)}
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 5).map((l, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="px-3 py-1 font-mono text-[var(--text-primary)]">@{l.username}</td>
                    {variaveisDisponiveis.map((v) => <td key={v} className="px-3 py-1 text-[var(--text-muted)] truncate max-w-[120px]">{l.variables[v]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {linhas.length > 5 && <p className="text-[10px] text-[var(--text-muted)] px-3 py-1 border-t border-[var(--border)]">+{linhas.length - 5} linha(s)...</p>}
          </div>
        )}

        <Button icon={agendar ? <CalendarClock size={14} /> : <Send size={14} />} onClick={handleEnviar} disabled={!podeEnviar} loading={enviando}>
          {enviando
            ? (agendar ? 'Agendando...' : 'Enviando...')
            : agendar
              ? `Agendar pra ${linhas.length || 0} usuário(s)`
              : `Enviar pra ${linhas.length || 0} usuário(s)`}
        </Button>

        {resultados && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Resultado do envio</h3>
            <div className="rounded-md border border-[var(--border)] overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-[var(--text-muted)]">Username</th>
                    <th className="text-left px-3 py-1.5 text-[var(--text-muted)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => (
                    <tr key={r.username} className="border-t border-[var(--border)]">
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">@{r.username}</td>
                      <td className={`px-3 py-1.5 ${r.ok ? 'text-emerald-400' : 'text-[var(--error)]'}`}>
                        {r.ok ? 'enviado' : (r.erro ?? 'erro')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
