'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ApresentacaoResultado } from '@/components/resultados-junho/ApresentacaoResultado'
import { Plus, X, Presentation, Globe, Copy, Save, ChevronDown, Image as ImageIcon } from 'lucide-react'
import type { Resultado, TopicosResultado } from '@/types'
import { FONTES_PRESET } from '@/components/resultados-junho/fontes'

function ListaEditavel({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const [novo, setNovo] = useState('')

  function adicionar() {
    const val = novo.trim()
    if (!val) return
    onChange([...items, val])
    setNovo('')
  }

  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1.5">{label}</label>
      <div className="space-y-1.5 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
            <span className="flex-1 text-xs text-[var(--text-primary)]">{item}</span>
            <button onClick={() => onChange(items.filter((_, i) => i !== idx))} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-1">
        <textarea
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); adicionar() } }}
          placeholder={placeholder}
          rows={2}
          className="flex-1 px-2 py-1.5 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors resize-none"
        />
        <Button size="sm" variant="ghost" onClick={adicionar} disabled={!novo.trim()}><Plus size={14} /></Button>
      </div>
    </div>
  )
}

function SecaoAccordion({
  titulo,
  aberta,
  onToggle,
  children,
}: {
  titulo: string
  aberta: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 text-sm font-medium text-[var(--text-primary)]"
      >
        {titulo}
        <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${aberta ? 'rotate-180' : ''}`} />
      </button>
      {aberta && <div className="pb-4">{children}</div>}
    </div>
  )
}

type Secao = 'capa' | 'estilo' | 'acertos' | 'atencao' | 'passos'

export default function EditarResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { addToast } = useToast()

  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [secaoAberta, setSecaoAberta] = useState<Secao>('capa')
  const [enviandoFundo, setEnviandoFundo] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)

  const [topicos, setTopicos] = useState<TopicosResultado>({ acertos: [], pontosAtencao: [], proximosPassos: [] })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/resultados/${id}`)
      const data = await res.json()
      if (res.ok) {
        setResultado(data.resultado)
        setTopicos({
          capaTituloPrincipal: data.resultado.topicos?.capaTituloPrincipal ?? '',
          capaSubtitulo: data.resultado.topicos?.capaSubtitulo ?? '',
          fechamentoTitulo: data.resultado.topicos?.fechamentoTitulo ?? '',
          fechamentoMensagem: data.resultado.topicos?.fechamentoMensagem ?? '',
          acertos: data.resultado.topicos?.acertos ?? [],
          pontosAtencao: data.resultado.topicos?.pontosAtencao ?? [],
          proximosPassos: data.resultado.topicos?.proximosPassos ?? [],
          fonte: data.resultado.topicos?.fonte ?? 'geist',
          capaImagemFundo: data.resultado.topicos?.capaImagemFundo ?? '',
          logos: data.resultado.topicos?.logos ?? [],
          logoAltura: data.resultado.topicos?.logoAltura ?? 48,
          capaTituloCor: data.resultado.topicos?.capaTituloCor ?? '',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    setSalvando(true)
    try {
      const res = await fetch(`/api/resultados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicos }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setResultado(data.resultado)
      addToast('success', 'Tópicos salvos')
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function alternarPublico() {
    setPublicando(true)
    try {
      const tornarPublico = !resultado?.publicToken
      const res = await fetch(`/api/resultados/${id}/publicar`, { method: tornarPublico ? 'POST' : 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao atualizar link público')
      setResultado(data.resultado)
      addToast('success', tornarPublico ? 'Link público criado' : 'Link público desativado')
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setPublicando(false)
    }
  }

  function copiarLink() {
    if (!resultado?.publicToken) return
    const url = `${window.location.origin}/r/${resultado.publicToken}`
    navigator.clipboard.writeText(url)
    addToast('success', 'Link copiado')
  }

  async function uploadImagem(file: File): Promise<string> {
    const body = new FormData()
    body.append('file', file)
    const res = await fetch('/api/resultados/upload-imagem', { method: 'POST', body })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar imagem')
    return data.url as string
  }

  async function onSelecionarFundo(file: File | undefined) {
    if (!file) return
    setEnviandoFundo(true)
    try {
      const url = await uploadImagem(file)
      setTopicos((t) => ({ ...t, capaImagemFundo: url }))
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setEnviandoFundo(false)
    }
  }

  async function onAdicionarLogo(file: File | undefined) {
    if (!file) return
    setEnviandoLogo(true)
    try {
      const url = await uploadImagem(file)
      setTopicos((t) => ({ ...t, logos: [...(t.logos ?? []), url] }))
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setEnviandoLogo(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner /></div>
  }

  if (!resultado) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">Resultado não encontrado.</div>
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 relative overflow-hidden">
        <ApresentacaoResultado titulo={resultado.titulo} dados={resultado.dados} topicos={topicos} />
      </div>

      <aside className="w-[320px] shrink-0 flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)]">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link href="/resultados" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">← Resultados</Link>
              <h1 className="text-sm font-semibold text-[var(--text-primary)] mt-1">{resultado.titulo}</h1>
              <p className="text-xs text-[var(--text-muted)]">{resultado.periodoInicio} a {resultado.periodoFim}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Link href={`/resultados/${id}/apresentar`} target="_blank" className="flex-1">
              <Button variant="secondary" size="sm" icon={<Presentation size={14} />} className="w-full">Tela cheia</Button>
            </Link>
            <Button
              variant={resultado.publicToken ? 'secondary' : 'primary'}
              size="sm"
              icon={<Globe size={14} />}
              onClick={alternarPublico}
              loading={publicando}
              className="flex-1"
            >
              {resultado.publicToken ? 'Despublicar' : 'Publicar'}
            </Button>
          </div>

          {resultado.publicToken && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px]">
              <Globe size={11} className="text-[var(--success)] shrink-0" />
              <code className="flex-1 text-[var(--text-secondary)] truncate">{`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${resultado.publicToken}`}</code>
              <button onClick={copiarLink} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"><Copy size={11} /></button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <SecaoAccordion titulo="Capa & fechamento" aberta={secaoAberta === 'capa'} onToggle={() => setSecaoAberta('capa')}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Título principal</label>
                <input
                  type="text"
                  value={topicos.capaTituloPrincipal}
                  onChange={(e) => setTopicos({ ...topicos, capaTituloPrincipal: e.target.value })}
                  placeholder="Retrospectiva"
                  className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Subtítulo da capa</label>
                <input
                  type="text"
                  value={topicos.capaSubtitulo}
                  onChange={(e) => setTopicos({ ...topicos, capaSubtitulo: e.target.value })}
                  placeholder={`${resultado.periodoInicio} a ${resultado.periodoFim} · Disparos WhatsApp`}
                  className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Cor do título (mês/ano)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={topicos.capaTituloCor || '#ffffff'}
                    onChange={(e) => setTopicos({ ...topicos, capaTituloCor: e.target.value })}
                    className="h-8 w-10 rounded border border-[var(--border)] bg-[var(--bg-base)] cursor-pointer"
                  />
                  <span className="text-xs text-[var(--text-muted)] flex-1">
                    {topicos.capaTituloCor ? topicos.capaTituloCor : 'Gradiente padrão'}
                  </span>
                  {topicos.capaTituloCor && (
                    <button
                      onClick={() => setTopicos({ ...topicos, capaTituloCor: '' })}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline transition-colors"
                    >
                      Usar gradiente
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Eyebrow de fechamento</label>
                <input
                  type="text"
                  value={topicos.fechamentoTitulo}
                  onChange={(e) => setTopicos({ ...topicos, fechamentoTitulo: e.target.value })}
                  placeholder="Fechando o período"
                  className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Mensagem de fechamento</label>
                <input
                  type="text"
                  value={topicos.fechamentoMensagem}
                  onChange={(e) => setTopicos({ ...topicos, fechamentoMensagem: e.target.value })}
                  placeholder="Obrigado ao time de disparos."
                  className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
                />
              </div>
            </div>
          </SecaoAccordion>

          <SecaoAccordion titulo="Fonte & imagens" aberta={secaoAberta === 'estilo'} onToggle={() => setSecaoAberta('estilo')}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Fonte</label>
                <select
                  value={topicos.fonte ?? 'geist'}
                  onChange={(e) => setTopicos({ ...topicos, fonte: e.target.value })}
                  className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors"
                >
                  {FONTES_PRESET.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1.5">Imagem de fundo da capa</label>
                {topicos.capaImagemFundo && (
                  <div className="relative mb-2 rounded overflow-hidden border border-[var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={topicos.capaImagemFundo} alt="" className="w-full h-24 object-cover" />
                    <button
                      onClick={() => setTopicos({ ...topicos, capaImagemFundo: '' })}
                      className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                <label className="flex items-center justify-center gap-2 h-8 px-3 text-xs rounded border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer">
                  <ImageIcon size={12} />
                  {enviandoFundo ? 'Enviando...' : 'Enviar imagem'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={enviandoFundo}
                    onChange={(e) => { onSelecionarFundo(e.target.files?.[0]); e.target.value = '' }}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1.5">Logotipos (acima do título)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(topicos.logos ?? []).map((url, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="max-w-full max-h-full object-contain" />
                      <button
                        onClick={() => setTopicos({ ...topicos, logos: (topicos.logos ?? []).filter((_, i) => i !== idx) })}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white hover:bg-black/80 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="flex items-center justify-center gap-2 h-8 px-3 text-xs rounded border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer">
                  <Plus size={12} />
                  {enviandoLogo ? 'Enviando...' : 'Adicionar logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={enviandoLogo}
                    onChange={(e) => { onAdicionarLogo(e.target.files?.[0]); e.target.value = '' }}
                  />
                </label>

                {(topicos.logos?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-[var(--text-muted)]">Tamanho do logo</label>
                      <span className="text-xs text-[var(--text-muted)]">{topicos.logoAltura ?? 48}px</span>
                    </div>
                    <input
                      type="range"
                      min={24}
                      max={160}
                      step={4}
                      value={topicos.logoAltura ?? 48}
                      onChange={(e) => setTopicos({ ...topicos, logoAltura: Number(e.target.value) })}
                      className="w-full accent-[var(--d1)]"
                    />
                  </div>
                )}
              </div>
            </div>
          </SecaoAccordion>

          <SecaoAccordion titulo="Acertos" aberta={secaoAberta === 'acertos'} onToggle={() => setSecaoAberta('acertos')}>
            <ListaEditavel
              label="Acertos"
              items={topicos.acertos}
              onChange={(acertos) => setTopicos({ ...topicos, acertos })}
              placeholder="Novo acerto..."
            />
          </SecaoAccordion>

          <SecaoAccordion titulo="Pontos de atenção" aberta={secaoAberta === 'atencao'} onToggle={() => setSecaoAberta('atencao')}>
            <ListaEditavel
              label="Pontos de atenção"
              items={topicos.pontosAtencao}
              onChange={(pontosAtencao) => setTopicos({ ...topicos, pontosAtencao })}
              placeholder="Novo ponto de atenção..."
            />
          </SecaoAccordion>

          <SecaoAccordion titulo="Próximos passos" aberta={secaoAberta === 'passos'} onToggle={() => setSecaoAberta('passos')}>
            <ListaEditavel
              label="Próximos passos"
              items={topicos.proximosPassos}
              onChange={(proximosPassos) => setTopicos({ ...topicos, proximosPassos })}
              placeholder="Novo próximo passo..."
            />
          </SecaoAccordion>
        </div>

        <div className="p-4 border-t border-[var(--border)]">
          {(enviandoFundo || enviandoLogo) && (
            <p className="text-xs text-[var(--text-muted)] mb-2 text-center">Aguarde o upload da imagem terminar...</p>
          )}
          <Button
            size="sm"
            icon={<Save size={14} />}
            onClick={salvar}
            loading={salvando}
            disabled={enviandoFundo || enviandoLogo}
            className="w-full"
          >
            Salvar tópicos
          </Button>
        </div>
      </aside>
    </div>
  )
}
