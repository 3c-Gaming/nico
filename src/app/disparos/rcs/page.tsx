'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Send, RefreshCw, Save, Plus, Trash2, Image as ImageIcon, CalendarClock, Link2, MessageSquare } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { UtmComboBox } from '@/components/ui/UtmComboBox'
import { useDisparos } from '@/hooks/useDisparos'
import { usePinnedDisparos } from '@/hooks/usePinnedDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import type { Disparo } from '@/types'
import type {
  RcsContent,
  RcsSuggestion,
  RcsSmsFallback,
  RcsMediaHeight,
  RcsCardOrientation,
} from '@/lib/rcs/tipos'
import { CUSTO_RCS_POR_ENVIO, LIMITE_FALLBACK_TEXT } from '@/lib/rcs/tipos'
import { renderizarRcsContent, extrairVariaveisRcs, validarRcsContent, validarFallback } from '@/lib/rcs/template'
import { RcsSuggestionChips } from '@/components/disparos/RcsSuggestionChips'

interface RcsTemplate {
  id: string
  nome: string
  tipo: 'text' | 'card'
  conteudo: RcsContent
  fallback?: RcsSmsFallback | null
}

interface LinhaBase {
  telefone: string
  variables: Record<string, string>
}

interface ResultadoEnvio {
  telefone: string
  ok: boolean
  status?: string
  erro?: string
}

const COLUNAS_TELEFONE = ['telefone', 'phone', 'numero', 'número', 'celular', 'whatsapp', 'to']
const HEIGHTS: RcsMediaHeight[] = ['SHORT', 'MEDIUM', 'TALL']
const ORIENTACOES: RcsCardOrientation[] = ['VERTICAL', 'HORIZONTAL']

const CASA_TRACKING_INFO = {
  superbet: { label: 'Superbet' },
  betmgm: { label: 'BetMGM' },
} as const
type CasaTracking = keyof typeof CASA_TRACKING_INFO

function getLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getLocalHora(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Parser simples de CSV (campos entre aspas podem ter vírgula). Mesmo do SMS-rápido.
function parsearCsv(texto: string): { headers: string[]; linhas: string[][] } {
  const linhasBrutas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  function parseLinha(linha: string): string[] {
    const campos: string[] = []
    let atual = ''
    let dentroAspas = false
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i]
      if (c === '"') dentroAspas = !dentroAspas
      else if (c === ',' && !dentroAspas) { campos.push(atual.trim()); atual = '' }
      else atual += c
    }
    campos.push(atual.trim())
    return campos
  }
  const [headerLinha, ...resto] = linhasBrutas
  return { headers: parseLinha(headerLinha), linhas: resto.map(parseLinha) }
}

function corStatus(status?: string): string {
  if (status === 'read') return 'text-violet-400 font-semibold'
  if (status === 'delivered') return 'text-emerald-400'
  if (status === 'undelivered' || status === 'failed' || status === 'erro') return 'text-[var(--error)]'
  return 'text-[var(--text-primary)]'
}

const inputCls =
  'w-full h-9 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors'

export default function RcsCompletoPage() {
  const { addToast } = useToast()
  const { create: createDisparo } = useDisparos()
  const { toggle: togglePin } = usePinnedDisparos()
  const { list: casasList } = useCasasAposta()

  // --- templates ---
  const [templates, setTemplates] = useState<RcsTemplate[]>([])
  const [templateSelId, setTemplateSelId] = useState<string>('')
  const [salvandoTemplate, setSalvandoTemplate] = useState(false)

  // --- builder ---
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'text' | 'card'>('card')
  const [texto, setTexto] = useState('')
  const [cardTitle, setCardTitle] = useState('')
  const [cardDesc, setCardDesc] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaHeight, setMediaHeight] = useState<RcsMediaHeight>('MEDIUM')
  const [orientation, setOrientation] = useState<RcsCardOrientation>('VERTICAL')
  const [suggestions, setSuggestions] = useState<RcsSuggestion[]>([])
  const [subindoImg, setSubindoImg] = useState(false)
  const fileImgRef = useRef<HTMLInputElement>(null)

  // --- fallback SMS (nativo da Solvefy) ---
  const [fallbackOn, setFallbackOn] = useState(false)
  const [fallbackFrom, setFallbackFrom] = useState('solvefy')
  const [fallbackText, setFallbackText] = useState('')

  // --- base / disparo ---
  const [campanha, setCampanha] = useState('')
  const [linhas, setLinhas] = useState<LinhaBase[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [colTelefone, setColTelefone] = useState('')
  const fileCsvRef = useRef<HTMLInputElement>(null)

  // --- tracking (opcional) — mesma UTM/casa do SMS, é o que traz Reg/FTD/CPA depois ---
  const [casaTracking, setCasaTracking] = useState<CasaTracking | ''>('')
  const [utmValor, setUtmValor] = useState('')

  const [agendar, setAgendar] = useState(false)
  const [dataAgendada, setDataAgendada] = useState(getLocalDate())
  const [horarioAgendado, setHorarioAgendado] = useState(getLocalHora())

  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null)
  const [atualizandoStatus, setAtualizandoStatus] = useState(false)

  useEffect(() => { carregarTemplates() }, [])

  async function carregarTemplates() {
    try {
      const res = await fetch('/api/rcs/templates')
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } catch { /* noop */ }
  }

  const conteudo: RcsContent = useMemo(() => {
    if (tipo === 'text') {
      return { type: 'text', text: texto, suggestions: suggestions.length ? suggestions : undefined }
    }
    return {
      type: 'card',
      card: {
        title: cardTitle || undefined,
        description: cardDesc || undefined,
        media: mediaUrl ? { url: mediaUrl, height: mediaHeight } : undefined,
        orientation,
        suggestions: suggestions.length ? suggestions : undefined,
      },
    }
  }, [tipo, texto, cardTitle, cardDesc, mediaUrl, mediaHeight, orientation, suggestions])

  const fallback: RcsSmsFallback | null = fallbackOn
    ? { enabled: true, from: fallbackFrom.trim(), text: fallbackText }
    : null

  const errosConteudo = useMemo(() => validarRcsContent(conteudo), [conteudo])
  const errosFallback = validarFallback(fallback)
  const variaveisTemplate = useMemo(() => extrairVariaveisRcs(conteudo), [conteudo])
  const colunasBase = headers.filter((h) => h && h !== colTelefone)
  const previewContent = useMemo(
    () => renderizarRcsContent(conteudo, linhas[0]?.variables ?? {}),
    [conteudo, linhas],
  )

  function carregarTemplateNoBuilder(t: RcsTemplate) {
    setTemplateSelId(t.id)
    setNome(t.nome)
    setTipo(t.conteudo.type)
    if (t.conteudo.type === 'text') {
      setTexto(t.conteudo.text)
      setSuggestions(t.conteudo.suggestions ?? [])
    } else {
      const c = t.conteudo.card
      setTexto('')
      setCardTitle(c.title ?? '')
      setCardDesc(c.description ?? '')
      setMediaUrl(c.media?.url ?? '')
      setMediaHeight(c.media?.height ?? 'MEDIUM')
      setOrientation(c.orientation ?? 'VERTICAL')
      setSuggestions(c.suggestions ?? [])
    }
    setFallbackOn(!!t.fallback?.enabled)
    setFallbackFrom(t.fallback?.from || 'solvefy')
    setFallbackText(t.fallback?.text || '')
  }

  function novoTemplate() {
    setTemplateSelId('')
    setNome('')
    setTipo('card')
    setTexto('')
    setCardTitle('')
    setCardDesc('')
    setMediaUrl('')
    setMediaHeight('MEDIUM')
    setOrientation('VERTICAL')
    setSuggestions([])
    setFallbackOn(false)
    setFallbackFrom('solvefy')
    setFallbackText('')
  }

  async function uploadImagem(file: File) {
    setSubindoImg(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/rcs/upload-imagem', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no upload')
      setMediaUrl(data.url)
      addToast('success', 'Imagem enviada')
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setSubindoImg(false)
    }
  }

  async function salvarTemplate() {
    if (!nome.trim()) { addToast('error', 'Dê um nome ao template'); return }
    if (errosConteudo.length) { addToast('error', errosConteudo[0]); return }
    if (errosFallback.length) { addToast('error', errosFallback[0]); return }
    setSalvandoTemplate(true)
    try {
      const url = templateSelId ? `/api/rcs/templates/${templateSelId}` : '/api/rcs/templates'
      const res = await fetch(url, {
        method: templateSelId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), conteudo, fallback }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      addToast('success', templateSelId ? 'Template atualizado' : 'Template criado')
      await carregarTemplates()
      setTemplateSelId(data.template.id)
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setSalvandoTemplate(false)
    }
  }

  async function excluirTemplate(id: string) {
    if (!confirm('Excluir esse template?')) return
    try {
      await fetch(`/api/rcs/templates/${id}`, { method: 'DELETE' })
      await carregarTemplates()
      if (templateSelId === id) novoTemplate()
      addToast('success', 'Template excluído')
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  function importarCsv(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const { headers: hdrs, linhas: cruas } = parsearCsv(String(reader.result ?? ''))
      const idxTel = hdrs.findIndex((h) => COLUNAS_TELEFONE.includes(h.toLowerCase()))
      const colTel = idxTel >= 0 ? hdrs[idxTel] : hdrs[0]
      setHeaders(hdrs)
      setColTelefone(colTel)
      setNomeArquivo(file.name)
      const idx = idxTel >= 0 ? idxTel : 0
      const parsed: LinhaBase[] = cruas
        .map((campos) => {
          const telefone = (campos[idx] ?? '').replace(/\D/g, '')
          const variables: Record<string, string> = {}
          hdrs.forEach((h, i) => { if (i !== idx && h) variables[h] = campos[i] ?? '' })
          return { telefone, variables }
        })
        .filter((l) => l.telefone.length >= 8)
      setLinhas(parsed)
      addToast('success', `${parsed.length} número(s) na base`)
    }
    reader.readAsText(file)
  }

  function colarNumeros(bruto: string) {
    const parsed: LinhaBase[] = bruto
      .split(/\r?\n/)
      .map((l) => l.replace(/\D/g, ''))
      .filter((t) => t.length >= 8)
      .map((telefone) => ({ telefone, variables: {} }))
    setHeaders([])
    setColTelefone('')
    setNomeArquivo(null)
    setLinhas(parsed)
  }

  const total = linhas.length
  // Teto: só é cobrado o que for entregue (falha = reembolso). O custo real aparece no
  // painel de detalhe depois, conforme os webhooks de entrega chegam.
  const custoTeto = total * CUSTO_RCS_POR_ENVIO
  const podeEnviar =
    campanha.trim().length > 1 && total > 0 && errosConteudo.length === 0 && errosFallback.length === 0 && !enviando

  async function criarRegistroDisparo(status: 'executado' | 'agendado'): Promise<Disparo | null> {
    const agora = new Date()
    const casaId = casaTracking
      ? casasList.find((c) => c.nome.toLowerCase().includes(casaTracking === 'superbet' ? 'super' : 'mgm'))?.id
      : undefined
    const novo: Disparo = {
      id: crypto.randomUUID(),
      tipo: 'PONTUAL',
      canal: 'rcs',
      nomenclatura: campanha.trim(),
      status,
      casasAposta: casaId ? [casaId] : [],
      dataDisparo: status === 'agendado' ? dataAgendada : getLocalDate(),
      horarioDisparo: status === 'agendado' ? horarioAgendado : getLocalHora(),
      base: { status: 'disponivel', totalRegistros: total, nomeArquivo: nomeArquivo ?? undefined },
      custoPorEnvio: CUSTO_RCS_POR_ENVIO,
      utm: casaTracking === 'superbet' ? utmValor.trim() || undefined : undefined,
      betmgmPid: casaTracking === 'betmgm' ? utmValor.trim() || undefined : undefined,
      rcsTemplateId: templateSelId || undefined,
      rcsConteudo: conteudo,
      rcsFallback: fallback ?? undefined,
      rcsDestinatarios: linhas.map((l) => ({ telefone: l.telefone, variables: l.variables })),
      criadoEm: agora.toISOString(),
      atualizadoEm: agora.toISOString(),
      notas: `Disparo RCS via Solvefy — campanha "${campanha.trim()}"`,
    }
    const res = await fetch('/api/disparos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disparo: novo }),
    })
    const data = await res.json()
    if (!data.disparo) return null
    createDisparo(data.disparo)
    togglePin(data.disparo.id)
    return data.disparo
  }

  async function handleEnviar() {
    if (!podeEnviar) return

    if (agendar) {
      const quando = new Date(`${dataAgendada}T${horarioAgendado}:00-03:00`)
      if (quando <= new Date()) { addToast('error', 'Escolha uma data/hora no futuro'); return }
      if (!confirm(`Agendar RCS pra ${total} número(s) em ${dataAgendada} às ${horarioAgendado}?`)) return
      setEnviando(true)
      try {
        const d = await criarRegistroDisparo('agendado')
        addToast(d ? 'success' : 'error', d ? 'Agendado — dispara sozinho e aparece em Disparos' : 'Não deu pra agendar')
      } catch (err) {
        addToast('error', (err as Error).message)
      } finally { setEnviando(false) }
      return
    }

    if (!confirm(`Enviar RCS agora pra ${total} número(s)? Custo até R$ ${custoTeto.toFixed(2)} (só entregues são cobrados).`)) return
    setEnviando(true)
    setResultados(null)
    try {
      const res = await fetch('/api/rcs/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campanha: campanha.trim(),
          conteudo,
          fallback,
          destinatarios: linhas.map((l) => ({ telefone: l.telefone, variables: l.variables })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no envio')
      setResultados(data.resultados ?? [])
      await criarRegistroDisparo('executado')
      addToast('success', `Enviado: ${data.enviados} ok, ${data.falhas} falha(s)`)
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function atualizarStatus() {
    if (!campanha.trim()) return
    setAtualizandoStatus(true)
    try {
      const res = await fetch('/api/rcs/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha: campanha.trim() }),
      })
      const data = await res.json()
      const porTel = new Map((data.envios as { telefone: string; status: string }[]).map((e) => [e.telefone, e.status]))
      setResultados((prev) => prev?.map((r) => ({ ...r, status: porTel.get(r.telefone) ?? r.status })) ?? null)
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setAtualizandoStatus(false)
    }
  }

  function addSuggestion(type: RcsSuggestion['type']) {
    if (suggestions.length >= 4) { addToast('error', 'Máximo de 4 botões'); return }
    setSuggestions([
      ...suggestions,
      type === 'OPEN_URL'
        ? { type: 'OPEN_URL', text: '', url: '' }
        : { type: 'REPLY', text: '', postbackData: '' },
    ])
  }
  function updSuggestion(i: number, patch: Partial<RcsSuggestion>) {
    setSuggestions(suggestions.map((s, idx) => (idx === i ? ({ ...s, ...patch } as RcsSuggestion) : s)))
  }
  function rmSuggestion(i: number) {
    setSuggestions(suggestions.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader titulo="Disparo RCS" descricao="Templates com imagem + botões, envio pra base via Solvefy" />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* ===== TEMPLATES ===== */}
        <section className="max-w-5xl p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Templates</h2>
            <Button size="sm" variant="secondary" onClick={novoTemplate}><Plus size={14} /> Novo</Button>
          </div>
          {templates.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Nenhum template salvo ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded border text-xs cursor-pointer transition-colors ${
                    templateSelId === t.id
                      ? 'border-[var(--border-strong)] bg-[var(--bg-elevated)]'
                      : 'border-[var(--border)] hover:bg-[var(--bg-elevated)]/50'
                  }`}
                  onClick={() => carregarTemplateNoBuilder(t)}
                >
                  <span className="font-medium text-[var(--text-primary)]">{t.nome}</span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase">{t.tipo}</span>
                  <button onClick={(e) => { e.stopPropagation(); excluirTemplate(t.id) }} className="text-[var(--text-muted)] hover:text-[var(--error)]">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 max-w-5xl">
          {/* ===== BUILDER ===== */}
          <section className="p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {templateSelId ? 'Editar template' : 'Novo template'}
            </h2>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Nome do template</label>
              <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Black Friday — card" />
            </div>

            <div className="flex gap-2">
              {(['card', 'text'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-3 h-8 rounded text-xs border transition-colors ${
                    tipo === t ? 'border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'
                  }`}
                >
                  {t === 'card' ? 'Card (imagem + botões)' : 'Texto simples'}
                </button>
              ))}
            </div>

            {tipo === 'text' ? (
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Texto {'(aceita {{variavel}})'}</label>
                <textarea
                  className={`${inputCls} h-24 py-2 resize-y`}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Olá {{nome}}, chegou a Black Friday!"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Título</label>
                  <input className={inputCls} value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="Black Friday" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Descrição</label>
                  <textarea
                    className={`${inputCls} h-20 py-2 resize-y`}
                    value={cardDesc}
                    onChange={(e) => setCardDesc(e.target.value)}
                    placeholder="50% OFF em toda a loja, {{nome}}!"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Imagem</label>
                  <div className="flex gap-2">
                    <input className={inputCls} value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://... (ou faça upload)" />
                    <Button size="sm" variant="secondary" loading={subindoImg} onClick={() => fileImgRef.current?.click()}>
                      <ImageIcon size={14} /> Upload
                    </Button>
                    <input
                      ref={fileImgRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImagem(f); e.target.value = '' }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Altura da imagem</label>
                    <select className={inputCls} value={mediaHeight} onChange={(e) => setMediaHeight(e.target.value as RcsMediaHeight)}>
                      {HEIGHTS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Orientação</label>
                    <select className={inputCls} value={orientation} onChange={(e) => setOrientation(e.target.value as RcsCardOrientation)}>
                      {ORIENTACOES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* suggestions */}
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Botões <span className="text-xs text-[var(--text-muted)] font-normal">({suggestions.length}/4)</span>
                </label>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => addSuggestion('OPEN_URL')} disabled={suggestions.length >= 4}>
                    <Link2 size={13} /> Botão de link
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => addSuggestion('REPLY')} disabled={suggestions.length >= 4}>
                    <MessageSquare size={13} /> Botão de resposta
                  </Button>
                </div>
              </div>
              {suggestions.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded px-3 py-2">
                  Nenhum botão. <strong>Botão de link</strong> abre uma URL; <strong>botão de resposta</strong> devolve um postback pro fluxo.
                </p>
              )}
              {suggestions.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-[10px] text-[var(--text-muted)] w-10 shrink-0">{s.type === 'OPEN_URL' ? 'LINK' : 'REPLY'}</span>
                  <input
                    className={`${inputCls} h-8`}
                    value={s.text}
                    onChange={(e) => updSuggestion(i, { text: e.target.value })}
                    placeholder="Texto do botão"
                  />
                  {s.type === 'OPEN_URL' ? (
                    <input
                      className={`${inputCls} h-8`}
                      value={s.url}
                      onChange={(e) => updSuggestion(i, { url: e.target.value } as Partial<RcsSuggestion>)}
                      placeholder="https://..."
                    />
                  ) : (
                    <input
                      className={`${inputCls} h-8`}
                      value={s.postbackData}
                      onChange={(e) => updSuggestion(i, { postbackData: e.target.value } as Partial<RcsSuggestion>)}
                      placeholder="postbackData (ex: subscribe_bf)"
                    />
                  )}
                  <button onClick={() => rmSuggestion(i)} className="text-[var(--text-muted)] hover:text-[var(--error)] shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* fallback SMS */}
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] cursor-pointer w-fit">
                <input type="checkbox" checked={fallbackOn} onChange={(e) => setFallbackOn(e.target.checked)} />
                Fallback SMS quando não suportar RCS
              </label>
              {fallbackOn && (
                <div className="space-y-2 pl-1">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    A Solvefy manda esse SMS automaticamente se o RCS não for entregue. Aceita <code>{'{{variavel}}'}</code> e <code>{'{{link}}'}</code> (o <code>{'{{link}}'}</code> puxa a URL do 1º botão de link do card).
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)] shrink-0">Remetente</span>
                    <input
                      className={`${inputCls} h-8`}
                      value={fallbackFrom}
                      onChange={(e) => setFallbackFrom(e.target.value)}
                      placeholder="solvefy"
                    />
                  </div>
                  <textarea
                    className={`${inputCls} h-24 py-2 resize-y`}
                    value={fallbackText}
                    onChange={(e) => setFallbackText(e.target.value)}
                    placeholder="Oi {{nome}}! Não deu pra te mandar o card, mas a oferta continua: {{link}}"
                  />
                  <p className={`text-[10px] ${fallbackText.length > LIMITE_FALLBACK_TEXT ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                    {fallbackText.length}/{LIMITE_FALLBACK_TEXT}
                  </p>
                </div>
              )}
            </div>

            {(errosConteudo.length > 0 || errosFallback.length > 0) && (
              <p className="text-xs text-[var(--error)]">⚠ {[...errosConteudo, ...errosFallback].join(' · ')}</p>
            )}

            <Button size="sm" onClick={salvarTemplate} loading={salvandoTemplate} disabled={errosConteudo.length > 0 || errosFallback.length > 0 || !nome.trim()}>
              <Save size={14} /> {templateSelId ? 'Salvar alterações' : 'Salvar template'}
            </Button>
          </section>

          {/* ===== PREVIEW ===== */}
          <section className="p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] h-fit sticky top-6">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Prévia</h2>
            <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-base)]">
              {previewContent.type === 'card' ? (
                <>
                  {previewContent.card.media?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewContent.card.media.url} alt="" className="w-full object-cover" style={{ maxHeight: mediaHeight === 'TALL' ? 260 : mediaHeight === 'SHORT' ? 110 : 170 }} />
                  )}
                  <div className="p-3 space-y-1">
                    {previewContent.card.title && <p className="text-sm font-semibold text-[var(--text-primary)]">{previewContent.card.title}</p>}
                    {previewContent.card.description && <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{previewContent.card.description}</p>}
                  </div>
                </>
              ) : (
                <div className="p-3">
                  <p className="text-xs text-[var(--text-primary)] whitespace-pre-wrap">{previewContent.type === 'text' ? previewContent.text : ''}</p>
                </div>
              )}
              <RcsSuggestionChips
                suggestions={previewContent.type === 'card' ? previewContent.card.suggestions : previewContent.suggestions}
              />
            </div>
            {variaveisTemplate.length > 0 && (
              <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                Variáveis: {variaveisTemplate.map((v) => (
                  <span key={v} className={colunasBase.includes(v) ? 'text-emerald-400' : 'text-red-400'}>{`{{${v}}} `}</span>
                ))}
              </p>
            )}
          </section>
        </div>

        {/* ===== DISPARO ===== */}
        <section className="max-w-5xl p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Disparo</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Nome da campanha</label>
              <input className={inputCls} value={campanha} onChange={(e) => setCampanha(e.target.value)} placeholder="rcs-black-friday-2026" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Base</label>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => fileCsvRef.current?.click()}>
                  <Upload size={14} /> CSV
                </Button>
                <input
                  ref={fileCsvRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importarCsv(f); e.target.value = '' }}
                />
                <span className="text-xs text-[var(--text-muted)] self-center">
                  {total > 0 ? `${total} número(s)${nomeArquivo ? ` · ${nomeArquivo}` : ''}` : 'ou cole abaixo'}
                </span>
              </div>
            </div>
          </div>

          {headers.length === 0 && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Colar números (um por linha)</label>
              <textarea
                className={`${inputCls} h-24 py-2 font-mono resize-y`}
                onChange={(e) => colarNumeros(e.target.value)}
                placeholder={'5531999999999\n5511988888888'}
              />
            </div>
          )}

          {/* tracking / UTM — opcional, é o que traz Reg/FTD/CPA depois */}
          <div className="space-y-1.5 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-base)]">
            <p className="text-xs font-medium text-[var(--text-primary)]">Tracking <span className="font-normal text-[var(--text-muted)]">(opcional — traz Reg/FTD/CPA depois)</span></p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded p-0.5">
                {(['', 'superbet', 'betmgm'] as const).map((opcao) => (
                  <button
                    key={opcao || 'nenhuma'}
                    type="button"
                    onClick={() => { setCasaTracking(opcao); setUtmValor('') }}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${casaTracking === opcao ? 'bg-[var(--d1)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {opcao === '' ? 'Sem tracking' : CASA_TRACKING_INFO[opcao].label}
                  </button>
                ))}
              </div>
              {casaTracking && (
                <div className="flex-1 min-w-[180px]">
                  <UtmComboBox value={utmValor} onChange={setUtmValor} casa={casaTracking} placeholder="UTM/PID dessa campanha..." />
                </div>
              )}
            </div>
            {casaTracking && !utmValor.trim() && (
              <p className="text-[10px] text-amber-400">Sem UTM/PID preenchida, o disparo aparece listado mas sem Reg/FTD/CPA calculado.</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <input type="checkbox" id="agendar" checked={agendar} onChange={(e) => setAgendar(e.target.checked)} />
            <label htmlFor="agendar" className="text-[var(--text-muted)]">Agendar</label>
            {agendar && (
              <>
                <input type="date" className={`${inputCls} h-8 w-auto`} value={dataAgendada} onChange={(e) => setDataAgendada(e.target.value)} />
                <input type="time" className={`${inputCls} h-8 w-auto`} value={horarioAgendado} onChange={(e) => setHorarioAgendado(e.target.value)} />
              </>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">
              {total} envio(s) · R$ {CUSTO_RCS_POR_ENVIO.toFixed(2)} por entregue · teto <strong className="text-[var(--text-primary)]">R$ {custoTeto.toFixed(2)}</strong> <span className="text-[var(--text-muted)]">(falha não é cobrada)</span>
            </span>
            <Button onClick={handleEnviar} loading={enviando} disabled={!podeEnviar}>
              {agendar ? <CalendarClock size={16} /> : <Send size={16} />}
              {agendar ? 'Agendar' : 'Enviar agora'}
            </Button>
          </div>
        </section>

        {/* ===== RESULTADOS ===== */}
        {resultados && (
          <section className="max-w-5xl p-4 rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Resultados — {resultados.filter((r) => r.ok).length}/{resultados.length} ok
              </h2>
              <Button size="sm" variant="secondary" onClick={atualizarStatus} loading={atualizandoStatus}>
                <RefreshCw size={14} /> Atualizar status
              </Button>
            </div>
            <div className="max-h-72 overflow-auto text-xs font-mono space-y-1">
              {resultados.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[var(--text-secondary)] w-32">{r.telefone}</span>
                  <span className={corStatus(r.status ?? (r.ok ? 'queued' : 'erro'))}>{r.status ?? (r.ok ? 'queued' : 'erro')}</span>
                  {r.erro && <span className="text-[var(--error)] truncate">{r.erro}</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
