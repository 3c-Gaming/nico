'use client'

import { useState, useEffect, useMemo, useSyncExternalStore, Fragment, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw, Play, Pause, FileText, AlertTriangle, Layers, Pen, Save, X, Search, Pin, Plus, Check, Download, Presentation, History, ChevronUp, ChevronDown, Eye } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { UtmComboBox } from '@/components/ui/UtmComboBox'
import { TagComboBox } from '@/components/ui/TagComboBox'
import { Dropdown } from '@/components/ui/Dropdown'
import { PainelApresentacoes } from '@/components/funis/PainelApresentacoes'
import { PainelConversasFluxo } from '@/components/funis/PainelConversasFluxo'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { getState, setState, updateFlowTagConfig, togglePinFunil, updateCacheMetricas } from '@/lib/store'
import { agruparTagsPorBot, contarLeadsIntervalo } from '@/lib/sendpulseLeads'
import { utmsDoFluxo, gerarRangeDatas, buscarResultadosDoDia, calcularResultadoLinhaNoDia, tagDeEntradaDoFluxo } from '@/lib/funis'
import type { NumeroSendpulse, FluxoSendpulse, CasaAposta } from '@/types'

function csvCampo(valor: string): string {
  if (valor.includes(',') || valor.includes('"') || valor.includes('\n')) {
    return `"${valor.replace(/"/g, '""')}"`
  }
  return valor
}

function baixarCsv(conteudo: string, nomeArquivo: string) {
  // BOM UTF-8 na frente: sem isso o Google Sheets/Excel às vezes erram a detecção de encoding
  // (ou simplesmente recusam a importação) em CSVs com acentos, tipo "Número"/"Tráfego".
  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

function getLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface FlowRow {
  botId: string
  botNome: string
  botNumero: string
  flow: FluxoSendpulse
  funil?: string | null
  utm?: string | null
  lpUrl?: string | null
  tipo: 'traffic' | 'disparo'
  tags: string[]
  casas: string[]
  leadsHoje: number
  total: number
  ultimoLeadAt: string | null
  carregandoContagens: boolean
  carregandoTotal: boolean
}

function chaveLinha(row: FlowRow): string {
  return `${row.botId}-${row.flow.id}`
}

function FlowStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
      status === 'ativo' ? 'text-green-500' :
      status === 'inativo' ? 'text-red-400' : 'text-amber-400'
    }`}>
      {status === 'ativo' ? <Play size={10} /> :
       status === 'rascunho' ? <FileText size={10} /> : <Pause size={10} />}
      {status === 'ativo' ? 'Ativo' :
       status === 'inativo' ? 'Inativo' : 'Rascunho'}
    </span>
  )
}

function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)]">
      {label}
    </span>
  )
}

function FunilChip({ label, cor, selecionado, onClick }: { label: string; cor?: string; selecionado?: boolean; onClick?: () => void }) {
  const c = cor ?? 'var(--d1)'
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: selecionado ? c : `${c}20`,
        border: `1px solid ${c}${selecionado ? '' : '30'}`,
        color: selecionado ? 'var(--bg-base)' : c,
      }}
      title={onClick ? (selecionado ? 'Clique pra remover da seleção' : 'Clique pra selecionar pra exportação') : undefined}
    >
      {selecionado && <Check size={10} strokeWidth={3} />}
      {label}
    </Tag>
  )
}

function formatarTempoRelativo(iso: string | null): { texto: string; cor: string } {
  if (!iso) return { texto: '—', cor: 'text-[var(--text-muted)]/40' }
  const agora = Date.now()
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return { texto: iso, cor: 'text-[var(--text-muted)]' }
  const diffMs = agora - ts
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffMin < 1) return { texto: 'agora', cor: 'text-green-400' }
  if (diffMin < 5) return { texto: 'agora', cor: 'text-green-400' }
  if (diffMin < 60) return { texto: `há ${diffMin}min`, cor: 'text-amber-400' }
  if (diffH < 24) return { texto: `há ${diffH}h`, cor: 'text-amber-400/70' }
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return { texto: `${dd}/${mm} ${hh}:${mm}`, cor: 'text-[var(--text-muted)]/60' }
}

function FlowTagEditor({ flow, botId, onSave }: { flow: FluxoSendpulse; botId: string; onSave: () => void }) {
  const configs = getState().flowTagConfigs
  const existing = configs[flow.id]
  const [funil, setFunil] = useState(existing?.funil ?? '')
  const [utm, setUtm] = useState(existing?.utm ?? '')
  const [utmsExtras, setUtmsExtras] = useState<string[]>(existing?.utmsExtras ?? [])
  const [utmExtraInput, setUtmExtraInput] = useState('')
  const [lpUrl, setLpUrl] = useState(existing?.lpUrl ?? '')
  const [tipo, setTipo] = useState<'traffic' | 'disparo'>(existing?.tipo ?? 'disparo')
  const [tags, setTags] = useState<string[]>(existing?.tags ?? [])
  const [casas, setCasas] = useState<string[]>(existing?.casas ?? [])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const casasAposta = Object.values(getState().casasAposta)

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  function moveTag(index: number, dir: -1 | 1) {
    const alvo = index + dir
    if (alvo < 0 || alvo >= tags.length) return
    const next = [...tags]
    ;[next[index], next[alvo]] = [next[alvo], next[index]]
    setTags(next)
  }

  function removeUtmExtra(valor: string) {
    setUtmsExtras(utmsExtras.filter((u) => u !== valor))
  }

  function toggleCasa(casaId: string) {
    setCasas((prev) => prev.includes(casaId) ? prev.filter((id) => id !== casaId) : [...prev, casaId])
  }

  async function handleSave() {
    setSaving(true)
    updateFlowTagConfig({ flowId: flow.id, botId, funil: funil || null, utm: utm || null, utmsExtras, lpUrl: lpUrl || null, tags, casas, tipo })
    await new Promise((r) => setTimeout(r, 200))
    setSaving(false)
    onSave()
  }

  const prevFunil = existing?.funil ?? ''
  const prevUtm = existing?.utm ?? ''
  const prevUtmsExtras = (existing?.utmsExtras ?? []).join(',')
  const prevLpUrl = existing?.lpUrl ?? ''
  const prevCasas = (existing?.casas ?? []).join(',')
  const hasChanges = prevFunil !== funil || prevUtm !== utm || prevUtmsExtras !== utmsExtras.join(',') || prevLpUrl !== lpUrl || (existing?.tipo ?? 'disparo') !== tipo || (existing?.tags ?? []).join(',') !== tags.join(',') || prevCasas !== casas.join(',')

  return (
    <div className="space-y-3 p-4 glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16">Funil:</span>
        <input
          type="text"
          value={funil}
          onChange={(e) => setFunil(e.target.value)}
          placeholder="ex: F26.02"
          className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16">UTM/PID:</span>
        <UtmComboBox
          value={utm}
          onChange={setUtm}
          placeholder="selecione ou digite e Enter para cadastrar"
        />
      </div>
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16 pt-1">UTMs extras:</span>
        <div className="flex-1 space-y-1.5">
          {utmsExtras.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {utmsExtras.map((valor) => (
                <span key={valor} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)]">
                  {valor}
                  <button onClick={() => removeUtmExtra(valor)} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <UtmComboBox
              value={utmExtraInput}
              onChange={setUtmExtraInput}
              placeholder="adicionar outra UTM/PID pra somar no mesmo funil..."
            />
            <button
              type="button"
              onClick={() => {
                const valor = utmExtraInput.trim()
                if (valor && valor !== utm && !utmsExtras.includes(valor)) setUtmsExtras([...utmsExtras, valor])
                setUtmExtraInput('')
              }}
              disabled={!utmExtraInput.trim()}
              className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40 shrink-0"
              title="Adicionar UTM extra"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16">LP URL:</span>
        <input
          type="url"
          value={lpUrl}
          onChange={(e) => setLpUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16">Tipo:</span>
        <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--border)] rounded p-0.5">
          <button
            onClick={() => setTipo('disparo')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${tipo === 'disparo' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Disparo
          </button>
          <button
            onClick={() => setTipo('traffic')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${tipo === 'traffic' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Tráfego
          </button>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16 pt-1">Tags:</span>
        <div className="flex-1 space-y-1.5">
          {tags.length > 0 && (
            <div className="space-y-1">
              {tags.map((tag, i) => (
                <div key={tag} className="flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
                  <span className="w-4 text-center text-[10px] font-mono text-[var(--text-muted)]/60 shrink-0">{i + 1}</span>
                  <span className="flex-1 text-xs font-mono text-[var(--text-primary)] truncate">{tag}</span>
                  <button
                    type="button"
                    onClick={() => moveTag(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-25 disabled:hover:text-[var(--text-muted)] disabled:hover:bg-transparent transition-colors"
                    title="Mover pra cima na jornada"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTag(i, 1)}
                    disabled={i === tags.length - 1}
                    className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-25 disabled:hover:text-[var(--text-muted)] disabled:hover:bg-transparent transition-colors"
                    title="Mover pra baixo na jornada"
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                    title="Remover tag"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-[var(--text-muted)]/60">
                A ordem acima é a jornada de qualificação (1ª tag que o lead recebe → última) — usada no funil de conversão do fluxo.
              </p>
            </div>
          )}
          <TagComboBox
            botId={botId}
            value={input}
            onChange={setInput}
            onSelect={(tag) => { if (!tags.includes(tag)) setTags([...tags, tag]); setInput('') }}
            existingTags={tags}
            placeholder="selecione ou digite uma tag..."
          />
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] w-16 pt-1">Casas:</span>
        <div className="flex-1 flex flex-wrap gap-1.5">
          {casasAposta.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)]/40 italic">Nenhuma casa cadastrada</span>
          ) : (
            casasAposta.map((casa) => {
              const selected = casas.includes(casa.id)
              return (
                <button
                  key={casa.id}
                  onClick={() => toggleCasa(casa.id)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: selected ? `${casa.cor}20` : 'var(--bg-elevated)',
                    border: `1px solid ${selected ? `${casa.cor}40` : 'var(--border)'}`,
                    color: selected ? casa.cor : 'var(--text-muted)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: casa.cor }} />
                  {casa.nome}
                </button>
              )
            })
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'var(--d1)' }}
        >
          <Save size={12} />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

const MAX_DIAS_EXPORT_INTERVALO = 31

function FunisPageInner() {
  const searchParams = useSearchParams()
  const [numeros, setNumeros] = useState<NumeroSendpulse[]>([])
  const [fluxosMap, setFluxosMap] = useState<Record<string, FluxoSendpulse[]>>({})
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const [ultimoLeadMap, setUltimoLeadMap] = useState<Record<string, string | null>>({})
  // Total de leads dentro do intervalo filtrado (trackingDataInicio..trackingDataFim) — não é
  // mais o total histórico da tag, é a soma real do período selecionado (mesma fonte/lógica que
  // já usávamos pra exportar por intervalo, só que aplicada direto na tela em vez de só no CSV).
  const [contagensIntervalo, setContagensIntervalo] = useState<Record<string, number>>({})
  const [carregandoIntervalo, setCarregandoIntervalo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroBot, setFiltroBot] = useState<string>('')
  const [filtroBusca, setFiltroBusca] = useState(searchParams.get('busca') ?? '')
  const [filtroCasas, setFiltroCasas] = useState<string[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'' | 'traffic' | 'disparo'>('')
  const { list: casasList } = useCasasAposta()
  // flowTagConfigs vem do DataInitializer (fetch assíncrono à parte) — sem isso, o efeito de
  // "Total" abaixo pode disparar antes das configs chegarem, ver getState().flowTagConfigs vazio,
  // desistir (grupos.length === 0) e nunca mais tentar sozinho. Esse valor muda de false pra true
  // uma vez (quando as configs terminam de carregar) e entra na dependência do efeito, garantindo
  // que ele tente de novo nesse momento em vez de ficar preso no "desistiu cedo demais".
  const flowTagConfigsProntas = useSyncExternalStore(
    (cb) => { window.addEventListener('nico:state-changed', cb); return () => window.removeEventListener('nico:state-changed', cb) },
    () => Object.keys(getState().flowTagConfigs).length > 0,
    () => false,
  )
  const [exportModo, setExportModo] = useState<'unico' | 'intervalo'>('unico')
  const [exportInicio, setExportInicio] = useState(getLocalDate())
  const [exportFim, setExportFim] = useState(getLocalDate())
  const [exportando, setExportando] = useState(false)
  const [exportProgresso, setExportProgresso] = useState('')
  const [exportErro, setExportErro] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [modalApresentarAberto, setModalApresentarAberto] = useState(false)
  const [tituloApresentacao, setTituloApresentacao] = useState('')
  const [apresentarUnicoRow, setApresentarUnicoRow] = useState<FlowRow | null>(null)
  const [tituloApresentacaoUnica, setTituloApresentacaoUnica] = useState('')
  const [salvandoApresentacaoUnica, setSalvandoApresentacaoUnica] = useState(false)
  const [painelApresentacoesAberto, setPainelApresentacoesAberto] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  // Só a chave da linha — os valores (leads/reg/ftd/contagens por tag) são recalculados a cada
  // render a partir do flowRows/contagensIntervalo/trackingMap atuais (ver conversasFluxoProps
  // abaixo), nunca capturados como snapshot no clique. Do contrário, se o painel for aberto antes
  // desses dados terminarem de carregar, ele ficaria com os números zerados pra sempre — o valor
  // "congela" no momento do clique e não reage a atualizações de estado depois disso.
  const [conversasFluxoKey, setConversasFluxoKey] = useState<string | null>(null)
  const [saveVersion, setSaveVersion] = useState(0)
  const [trackingMap, setTrackingMap] = useState<Record<string, { registros: number; ftds: number }>>({})
  const [trackingDataInicio, setTrackingDataInicio] = useState(getLocalDate())
  const [trackingDataFim, setTrackingDataFim] = useState(getLocalDate())
  const [trackingLoaded, setTrackingLoaded] = useState(false)
  // flow.id -> ainda esperando a contagem de leads de hoje daquele fluxo especificamente
  const [carregandoFlows, setCarregandoFlows] = useState<Set<string>>(new Set())

  async function carregarDados() {
    setLoading(!refreshing)
    setRefreshing(true)
    setError(null)

    try {
      const numRes = await fetch('/api/sendpulse/numeros')
      if (!numRes.ok) throw new Error('Erro ao carregar números')
      const numData = await numRes.json()
      const nums: NumeroSendpulse[] = numData.numeros
      setNumeros(nums)

      const naoMonitorados = getState().numerosNaoMonitorados
      const fluxos: Record<string, FluxoSendpulse[]> = {}
      await Promise.allSettled(
        nums.filter((num) => !naoMonitorados.includes(num.id)).map(async (num) => {
          const fRes = await fetch(`/api/sendpulse/fluxos?bot_id=${encodeURIComponent(num.id)}`)
          if (!fRes.ok) return
          const fData = await fRes.json()
          fluxos[num.id] = fData.fluxos
        })
      )
      setFluxosMap(fluxos)

      const configs = getState().flowTagConfigs
      const flowsComTags = Object.values(fluxos).flat().filter((f) => (configs[f.id]?.tags?.length ?? 0) > 0)

      // Um POST só com as tags de TODOS os fluxos de uma vez: se demorar/falhar (muitas
      // tags, um bot lento), a tabela inteira fica sem "Leads hoje". Busca fluxo a fluxo,
      // em paralelo mas isolado — um lento/com erro não trava os demais, e cada linha
      // resolve (e para de girar o spinner) assim que a sua própria resposta chega.
      setCarregandoFlows(new Set(flowsComTags.map((f) => f.id)))
      await Promise.allSettled(
        flowsComTags.map(async (f) => {
          const tags = configs[f.id]?.tags ?? []
          const botId = configs[f.id]?.botId
          try {
            const res = await fetch('/api/leadhub/contagem-hoje-sendpulse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ botId, tags }),
            })
            if (res.ok) {
              const data = await res.json()
              setContagens((prev) => ({ ...prev, ...data.leads }))
              setUltimoLeadMap((prev) => ({ ...prev, ...data.ultimoLead }))
            }
          } finally {
            setCarregandoFlows((prev) => {
              const next = new Set(prev)
              next.delete(f.id)
              return next
            })
          }
        }),
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { carregarDados() }, [saveVersion])

  // Intervalo de um dia só e esse dia é hoje: "Total" seria exatamente o mesmo número que "Leads
  // hoje" (mesma tag, mesmo dia) — usa contagens direto em vez de refazer a busca por um caminho
  // mais lento (getByTag paginado, pensado pra intervalos de vários dias). Isso é o que fazia
  // "Total" ser sempre o último dado a aparecer na tela: um trabalho duplicado e mais lento pro
  // mesmo resultado que "Leads hoje" já tinha. Derivado, não é state — sem efeito nenhum pra
  // sincronizar, só uma leitura diferente na hora de usar.
  const hojeISO = getLocalDate()
  const intervaloEhHojeUnico = trackingDataInicio === hojeISO && trackingDataFim === hojeISO
  const contagensIntervaloEfetivo = intervaloEhHojeUnico ? contagens : contagensIntervalo

  // Total de leads no intervalo filtrado (todas as tags de todos os fluxos, não só os com UTM —
  // "Total" na tela precisa disso pra qualquer fluxo com tag configurada). Direto na SendPulse
  // (getByTag paginado), agrupado por bot — não usa mais o LeadHub (~60-70s fixos por chamada,
  // bem mais lento que paginar direto na fonte). Só roda pra intervalos que não sejam "hoje único"
  // (ver efeito acima) — inclui flowTagConfigsProntas na dependência pra tentar de novo assim que
  // as configs terminarem de carregar, caso o primeiro disparo tenha achado tudo vazio ainda.
  useEffect(() => {
    if (intervaloEhHojeUnico) return
    let cancelado = false

    async function carregarTotalIntervalo() {
      const configs = getState().flowTagConfigs
      const grupos = agruparTagsPorBot(Object.values(configs).map((c) => ({ botId: c.botId, tags: c.tags ?? [] })))
      if (!grupos.length) return

      setCarregandoIntervalo(true)
      setContagensIntervalo({})
      try {
        const leads = await contarLeadsIntervalo(grupos, trackingDataInicio, trackingDataFim)
        if (!cancelado) setContagensIntervalo(leads)
      } catch {
        // Total no intervalo é complementar — falha aqui não deve travar o resto da tela
      } finally {
        if (!cancelado) setCarregandoIntervalo(false)
      }
    }

    carregarTotalIntervalo()
    return () => { cancelado = true }
  }, [trackingDataInicio, trackingDataFim, saveVersion, flowTagConfigsProntas, intervaloEhHojeUnico])

  // Busca tracking 3CGG para todos os flows que têm utm
  useEffect(() => {
    const configs = getState().flowTagConfigs
    const withUtm = Object.values(configs).filter((c) => utmsDoFluxo(c).length > 0)
    if (!withUtm.length) return

    async function fetchTracking() {
      const datas = gerarRangeDatas(trackingDataInicio, trackingDataFim).slice(0, MAX_DIAS_EXPORT_INTERVALO)
      if (!datas.length) return

      const porDia = await Promise.all(datas.map(async (data) => {
        const [superbetRes, betmgmRes] = await Promise.all([
          fetch(`/api/tracking/export?casa=superbet&date=${data}`).then((r) => r.json()).catch(() => ({})),
          fetch(`/api/tracking/export?casa=betmgm&date=${data}`).then((r) => r.json()).catch(() => ({})),
        ])
        return {
          superbetEvents: (superbetRes as any)?.data ?? [] as any[],
          betmgmEvents: (betmgmRes as any)?.data ?? [] as any[],
        }
      }))

      const novo: Record<string, { registros: number; ftds: number }> = {}
      for (const cfg of withUtm) {
        const utms = utmsDoFluxo(cfg)
        let registros = 0
        let ftds = 0
        for (const dia of porDia) {
          for (const item of dia.superbetEvents) {
            if (utms.some((utm) => String(item.acid).includes(utm))) {
              registros += item.registrations ?? 0
              ftds += item.ftds ?? 0
            }
          }
          for (const item of dia.betmgmEvents) {
            if (utms.some((utm) => String(item.marketing_source_id) === utm)) {
              registros += item.registrations ?? 0
              ftds += item.ftds ?? 0
            }
          }
        }
        novo[cfg.flowId] = { registros, ftds }
      }
      setTrackingMap(novo)

      // Salva cache por funil no banco
      const configsSnapshot = getState().flowTagConfigs
      const perFunil: Record<string, { registros: number; ftds: number }> = {}
      for (const [flowId, val] of Object.entries(novo)) {
        const cfg = configsSnapshot[flowId]
        if (cfg?.funil) {
          if (!perFunil[cfg.funil]) perFunil[cfg.funil] = { registros: 0, ftds: 0 }
          perFunil[cfg.funil].registros += val.registros
          perFunil[cfg.funil].ftds += val.ftds
        }
      }
      const cacheArr = Object.entries(perFunil).map(([funil, val]) => ({
        funil,
        leadsHoje: 0,
        totalLeads: 0,
        registros: val.registros,
        ftds: val.ftds,
        atualizadoEm: new Date().toISOString(),
      }))
      if (cacheArr.length > 0) updateCacheMetricas(cacheArr)

      setTrackingLoaded(true)
    }

    fetchTracking()
  }, [trackingDataInicio, trackingDataFim, saveVersion])

  const flowRows = useMemo(() => {
    const termo = filtroBusca.toLowerCase()
    const rows: FlowRow[] = []
    for (const num of numeros) {
      if (filtroBot && num.id !== filtroBot) continue
      if (getState().numerosNaoMonitorados.includes(num.id)) continue
      const flows = fluxosMap[num.id]
      if (!flows) continue
      for (const flow of flows) {
        const configs = getState().flowTagConfigs
        const tags = configs[flow.id]?.tags ?? []
        const funil = configs[flow.id]?.funil
        const tagEntrada = tagDeEntradaDoFluxo(tags)
        const leads = tagEntrada ? (contagens[tagEntrada] ?? 0) : 0
        const total = tagEntrada ? (contagensIntervaloEfetivo[tagEntrada] ?? 0) : 0
        const ultimoLeadAt = tags.reduce<string | null>((best, t) => {
          const ts = ultimoLeadMap[t] ?? null
          if (!ts) return best
          if (!best || ts > best) return ts
          return best
        }, null)
        if (termo && !flow.nome.toLowerCase().includes(termo) && !(funil ?? '').toLowerCase().includes(termo)) continue
        const casas = configs[flow.id]?.casas ?? []
        if (filtroCasas.length > 0 && !casas.some((id) => filtroCasas.includes(id))) continue
        const tipo = configs[flow.id]?.tipo ?? 'disparo'
        if (filtroTipo && tipo !== filtroTipo) continue
        rows.push({
          botId: num.id,
          botNome: num.nome,
          botNumero: num.numero,
          flow,
          funil,
          utm: configs[flow.id]?.utm,
          lpUrl: configs[flow.id]?.lpUrl,
          tipo,
          tags,
          casas,
          leadsHoje: leads,
          total,
          ultimoLeadAt,
          carregandoContagens: tags.length > 0 && carregandoFlows.has(flow.id),
          carregandoTotal: tags.length > 0 && (intervaloEhHojeUnico ? carregandoFlows.has(flow.id) : carregandoIntervalo),
        })
      }
    }
    rows.sort((a, b) => {
      if (a.leadsHoje !== b.leadsHoje) return b.leadsHoje - a.leadsHoje
      if ((a.funil ?? '') !== (b.funil ?? '')) return (b.funil ?? '').localeCompare(a.funil ?? '')
      return a.botNome.localeCompare(b.botNome)
    })
    return rows
  }, [numeros, fluxosMap, contagens, contagensIntervaloEfetivo, ultimoLeadMap, carregandoFlows, carregandoIntervalo, intervaloEhHojeUnico, filtroBot, filtroBusca, filtroCasas, filtroTipo])

  const totalComFunil = flowRows.filter((r) => r.funil).length

  // Recalculado a cada render a partir do estado atual (não é um snapshot capturado no clique) —
  // assim o painel de detalhes sempre mostra os números mais recentes, mesmo se tiver sido aberto
  // antes de contagensIntervalo/trackingMap terminarem de carregar.
  const conversasFluxoRow = conversasFluxoKey ? flowRows.find((r) => chaveLinha(r) === conversasFluxoKey) ?? null : null
  const conversasFluxoProps = conversasFluxoRow ? {
    botId: conversasFluxoRow.botId,
    flowId: conversasFluxoRow.flow.id,
    tag: tagDeEntradaDoFluxo(conversasFluxoRow.tags)!,
    flowNome: conversasFluxoRow.funil || conversasFluxoRow.flow.nome,
    tags: conversasFluxoRow.tags,
    contagensPorTag: conversasFluxoRow.tags.reduce<Record<string, number>>((acc, t) => {
      acc[t] = contagensIntervaloEfetivo[t] ?? 0
      return acc
    }, {}),
    cor: (() => {
      const primeiraId = conversasFluxoRow.casas[0]
      if (!primeiraId) return undefined
      return (getState().casasAposta as Record<string, CasaAposta>)[primeiraId]?.cor
    })(),
    leadsHoje: conversasFluxoRow.leadsHoje,
    total: conversasFluxoRow.total,
    registros: trackingMap[conversasFluxoRow.flow.id]?.registros ?? 0,
    ftds: trackingMap[conversasFluxoRow.flow.id]?.ftds ?? 0,
    periodoLabel: trackingDataInicio === trackingDataFim ? trackingDataInicio : `${trackingDataInicio} até ${trackingDataFim}`,
    dataReferencia: trackingDataFim,
    utm: getState().flowTagConfigs[conversasFluxoRow.flow.id]?.utm ?? null,
    utmsExtras: getState().flowTagConfigs[conversasFluxoRow.flow.id]?.utmsExtras ?? [],
  } : null

  function toggleSelecionado(key: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSelecionarTodos() {
    const chaves = flowRows.filter((r) => r.funil).map(chaveLinha)
    const todosSelecionados = chaves.length > 0 && chaves.every((k) => selecionados.has(k))
    setSelecionados(todosSelecionados ? new Set() : new Set(chaves))
  }

  const chavesComFunil = flowRows.filter((r) => r.funil).map(chaveLinha)
  const todosFunisSelecionados = chavesComFunil.length > 0 && chavesComFunil.every((k) => selecionados.has(k))

  // Quando nada está selecionado, exporta tudo que está filtrado na tela (comportamento
  // anterior); selecionar alguma linha restringe a exportação só a essas.
  const linhasParaExportar = selecionados.size > 0 ? flowRows.filter((r) => selecionados.has(chaveLinha(r))) : flowRows

  function exportarCsvUnico() {
    const dataLabel = trackingDataInicio === trackingDataFim ? trackingDataInicio : `${trackingDataInicio}_a_${trackingDataFim}`
    const casasPorId = new Map(casasList.map((c) => [c.id, c.nome]))
    const header = ['Data', 'Funil', 'Tipo', 'Casas', 'Bot', 'Número', 'Fluxo', 'Tags', 'Leads hoje', 'Total', 'Registros', 'FTDs', 'Conv. FTD %', 'Conv. Reg %']
    const linhas = linhasParaExportar.map((row) => {
      const registros = trackingMap[row.flow.id]?.registros ?? 0
      const ftds = trackingMap[row.flow.id]?.ftds ?? 0
      const convFtd = row.leadsHoje > 0 ? ((ftds / row.leadsHoje) * 100).toFixed(1) : ''
      const convReg = row.leadsHoje > 0 ? ((registros / row.leadsHoje) * 100).toFixed(1) : ''
      return [
        dataLabel,
        row.funil ?? '',
        row.tipo === 'traffic' ? 'Tráfego' : 'Disparo',
        row.casas.map((id) => casasPorId.get(id) ?? id).join('; '),
        row.botNome,
        row.botNumero,
        row.flow.nome,
        row.tags.join('; '),
        String(row.leadsHoje),
        String(row.total),
        String(registros),
        String(ftds),
        convFtd,
        convReg,
      ].map(csvCampo).join(',')
    })
    baixarCsv([header.join(','), ...linhas].join('\n'), `funis-resultados-${dataLabel}.csv`)
  }

  async function exportarCsvIntervalo() {
    const datas = gerarRangeDatas(exportInicio, exportFim)
    if (datas.length === 0) { setExportErro('Intervalo inválido'); return }
    if (datas.length > MAX_DIAS_EXPORT_INTERVALO) {
      setExportErro(`Máximo de ${MAX_DIAS_EXPORT_INTERVALO} dias por exportação`)
      return
    }
    setExportErro(null)
    setExportando(true)
    setExportProgresso(`0 / ${datas.length} dia(s)...`)
    try {
      const gruposBotTags = agruparTagsPorBot(linhasParaExportar.map((r) => ({ botId: r.botId, tags: r.tags })))
      const resultadosPorDia = new Map<string, Awaited<ReturnType<typeof buscarResultadosDoDia>>>()
      let concluidos = 0
      await Promise.all(datas.map(async (data) => {
        const resultado = await buscarResultadosDoDia(data, gruposBotTags)
        resultadosPorDia.set(data, resultado)
        concluidos++
        setExportProgresso(`${concluidos} / ${datas.length} dia(s)...`)
      }))

      const casasPorId = new Map(casasList.map((c) => [c.id, c.nome]))
      const header = ['Data', 'Funil', 'Tipo', 'Casas', 'Bot', 'Número', 'Fluxo', 'Tags', 'Leads', 'Registros', 'FTDs', 'Conv. FTD %', 'Conv. Reg %']
      const linhas: string[] = []
      for (const data of datas) {
        const dia = resultadosPorDia.get(data)
        if (!dia) continue
        for (const row of linhasParaExportar) {
          const cfg = getState().flowTagConfigs[row.flow.id]
          const { leads, registros, ftds, convFtd: convFtdNum, convReg: convRegNum } = calcularResultadoLinhaNoDia(cfg ?? {}, dia)
          const convFtd = convFtdNum !== null ? convFtdNum.toFixed(1) : ''
          const convReg = convRegNum !== null ? convRegNum.toFixed(1) : ''
          linhas.push([
            data,
            row.funil ?? '',
            row.tipo === 'traffic' ? 'Tráfego' : 'Disparo',
            row.casas.map((id) => casasPorId.get(id) ?? id).join('; '),
            row.botNome,
            row.botNumero,
            row.flow.nome,
            row.tags.join('; '),
            String(leads),
            String(registros),
            String(ftds),
            convFtd,
            convReg,
          ].map(csvCampo).join(','))
        }
      }
      baixarCsv([header.join(','), ...linhas].join('\n'), `funis-resultados-${exportInicio}_a_${exportFim}.csv`)
    } catch {
      setExportErro('Erro ao gerar exportação — tente novamente')
    } finally {
      setExportando(false)
      setExportProgresso('')
    }
  }

  function abrirModalApresentar() {
    if (linhasParaExportar.length === 0) return
    setTituloApresentacao(`${linhasParaExportar.length} funis — ${trackingDataInicio} até ${trackingDataFim}`)
    setModalApresentarAberto(true)
  }

  function confirmarApresentar() {
    const flowIds = linhasParaExportar.map((r) => r.flow.id)
    const funis = linhasParaExportar.map((r) => r.funil ?? r.flow.nome)
    const params = new URLSearchParams({
      flows: flowIds.join(','),
      inicio: trackingDataInicio,
      fim: trackingDataFim,
    })
    // Abre a aba já, dentro do gesto de clique — evita bloqueio de pop-up. O salvamento roda em
    // paralelo, sem travar a abertura.
    window.open(`/funis/apresentar?${params.toString()}`, '_blank')
    setModalApresentarAberto(false)
    fetch('/api/funis-comparacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: tituloApresentacao || `${flowIds.length} funis — ${trackingDataInicio} até ${trackingDataFim}`,
        flowIds,
        funis,
        inicio: trackingDataInicio,
        fim: trackingDataFim,
      }),
    }).catch(() => {})
  }

  function abrirModalApresentarUnico(row: FlowRow) {
    setTituloApresentacaoUnica(`${row.funil ?? row.flow.nome} — ${trackingDataInicio} até ${trackingDataFim}`)
    setApresentarUnicoRow(row)
  }

  async function confirmarApresentarUnico() {
    if (!apresentarUnicoRow) return
    const row = apresentarUnicoRow
    // Diferente da comparação, aqui precisa esperar o POST responder antes de abrir — a página
    // usa o id do registro pra carregar/editar os comentários, não dá pra ser só query params.
    // Abre a aba em branco já (dentro do gesto de clique, evita bloqueio de pop-up) e só navega
    // ela de fato quando o id chegar.
    const novaAba = window.open('', '_blank')
    setSalvandoApresentacaoUnica(true)
    try {
      const res = await fetch('/api/funis-apresentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: tituloApresentacaoUnica || `${row.funil ?? row.flow.nome} — ${trackingDataInicio} até ${trackingDataFim}`,
          flowId: row.flow.id,
          funil: row.funil ?? row.flow.nome,
          inicio: trackingDataInicio,
          fim: trackingDataFim,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (novaAba) novaAba.location.href = `/funis/apresentar-funil?id=${data.apresentacao.id}`
    } catch {
      novaAba?.close()
    } finally {
      setSalvandoApresentacaoUnica(false)
      setApresentarUnicoRow(null)
    }
  }

  return (
    <>
      <PageHeader
        titulo="Funis"
        descricao="Monitoramento de fluxos por tag"
        acoes={
          <div className="flex items-center gap-2">
            <Dropdown
              align="right"
              label={
                <span className="flex items-center gap-1.5">
                  <Download size={14} />
                  Exportar CSV
                </span>
              }
            >
              <div className="p-3 space-y-2.5 w-[280px]">
                <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--border)] rounded p-0.5">
                  <button
                    onClick={() => setExportModo('unico')}
                    className={`flex-1 px-2 py-1 text-xs rounded font-medium transition-colors ${exportModo === 'unico' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    Resumo
                  </button>
                  <button
                    onClick={() => setExportModo('intervalo')}
                    className={`flex-1 px-2 py-1 text-xs rounded font-medium transition-colors ${exportModo === 'intervalo' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    Por dia
                  </button>
                </div>

                {exportModo === 'unico' ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    Uma linha por funil, somando o período do filtro:{' '}
                    <strong className="text-[var(--text-primary)]">
                      {trackingDataInicio === trackingDataFim ? trackingDataInicio : `${trackingDataInicio} até ${trackingDataFim}`}
                    </strong>
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={exportInicio}
                        onChange={(e) => setExportInicio(e.target.value)}
                        className="flex-1 h-7 px-1.5 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                      />
                      <span className="text-xs text-[var(--text-muted)]">até</span>
                      <input
                        type="date"
                        value={exportFim}
                        onChange={(e) => setExportFim(e.target.value)}
                        className="flex-1 h-7 px-1.5 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Uma linha por fluxo por dia, no mesmo CSV. Até {MAX_DIAS_EXPORT_INTERVALO} dias — cada exportação
                      busca o histórico de leads (não tem atalho rápido pra datas passadas), pode levar cerca de 1min.
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-[var(--text-muted)]">
                  {selecionados.size > 0
                    ? `${selecionados.size} funil(is) selecionado(s) — exporta só esses.`
                    : `Nenhum funil marcado — exporta todos os ${flowRows.length} filtrado(s) na tela.`}
                </p>

                {exportErro && <p className="text-xs text-[var(--error)]">{exportErro}</p>}

                <button
                  onClick={exportModo === 'unico' ? exportarCsvUnico : exportarCsvIntervalo}
                  disabled={linhasParaExportar.length === 0 || exportando}
                  className="flex items-center justify-center gap-1.5 w-full h-8 rounded text-xs font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'var(--d1)' }}
                >
                  {exportando ? (
                    <>
                      <Spinner size={12} />
                      {exportProgresso || 'Gerando...'}
                    </>
                  ) : (
                    <>
                      <Download size={12} />
                      Baixar CSV
                    </>
                  )}
                </button>
              </div>
            </Dropdown>
            <button
              onClick={abrirModalApresentar}
              disabled={linhasParaExportar.length === 0}
              className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
            >
              <Presentation size={14} />
              Apresentar dados
            </button>
            <button
              onClick={() => setPainelApresentacoesAberto(true)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <History size={14} />
              Apresentações
            </button>
            <button
              onClick={() => setSaveVersion((v) => v + 1)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Carregando...' : 'Recarregar'}
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-[var(--text-muted)]">Bot:</label>
          <select
            value={filtroBot}
            onChange={(e) => setFiltroBot(e.target.value)}
            className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
          >
            <option value="">Todos</option>
            {numeros
              .filter((num) => num.status === 'ativo')
              .sort((a, b) => a.numero.localeCompare(b.numero))
              .map((num) => (
                <option key={num.id} value={num.id}>{num.numero}</option>
              ))}
          </select>

          <Dropdown label={`Casa${filtroCasas.length > 0 ? ` (${filtroCasas.length})` : ''}`}>
            <div className="p-2 max-h-48 overflow-y-auto min-w-[160px]">
              {casasList.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-[var(--text-muted)]">Nenhuma casa cadastrada</p>
              ) : (
                casasList.map((casa) => {
                  const selected = filtroCasas.includes(casa.id)
                  return (
                    <button
                      key={casa.id}
                      onClick={() => setFiltroCasas((prev) => selected ? prev.filter((id) => id !== casa.id) : [...prev, casa.id])}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: casa.cor }} />
                      <span className="flex-1 text-left">{casa.nome}</span>
                      {selected && <Check size={14} className="text-[var(--d1)]" />}
                    </button>
                  )
                })
              )}
            </div>
          </Dropdown>

          <Dropdown label={filtroTipo ? (filtroTipo === 'traffic' ? 'Tipo: Tráfego' : 'Tipo: Disparo') : 'Tipo'}>
            <div className="p-1 min-w-[140px]">
              {([['', 'Todos'], ['disparo', 'Disparo'], ['traffic', 'Tráfego']] as const).map(([valor, label]) => {
                const selected = filtroTipo === valor
                return (
                  <button
                    key={valor}
                    onClick={() => setFiltroTipo(valor)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
                  >
                    <span className="flex-1 text-left">{label}</span>
                    {selected && <Check size={14} className="text-[var(--d1)]" />}
                  </button>
                )
              })}
            </div>
          </Dropdown>

          <div className="flex items-center gap-1.5 flex-1 max-w-xs">
            <Search size={14} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Buscar por fluxo ou funil…"
              className="flex-1 h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={trackingDataInicio}
              onChange={(e) => setTrackingDataInicio(e.target.value)}
              className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
            <span className="text-xs text-[var(--text-muted)]">até</span>
            <input
              type="date"
              value={trackingDataFim}
              onChange={(e) => setTrackingDataFim(e.target.value)}
              className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          </div>

          <span className="text-xs text-[var(--text-muted)] ml-auto whitespace-nowrap">
            {flowRows.length} fluxo(s)
            {totalComFunil > 0 && (
              <span className="ml-1">
                · {totalComFunil} com funil
              </span>
            )}
            {flowRows.filter((r) => r.tags.length > 0).length > 0 && (
              <span className="ml-1">
                · {flowRows.filter((r) => r.tags.length > 0).length} com tag(s)
              </span>
            )}
          </span>
        </div>

        {loading && numeros.length === 0 && (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        )}

        {!loading && numeros.length === 0 && !error && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum bot encontrado.
          </div>
        )}

        {flowRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      Funil
                      {chavesComFunil.length > 0 && (
                        <button
                          onClick={toggleSelecionarTodos}
                          className="text-[10px] font-medium normal-case text-[var(--d1)] hover:underline"
                        >
                          {todosFunisSelecionados ? 'limpar' : 'selecionar todos'}
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Número</th>
                   <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Fluxo</th>
                   <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Flow ID</th>
                   <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Tags</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Último lead</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Leads hoje</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Total</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Reg</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">FTDs</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="FTDs de hoje ÷ Leads hoje">Conv. FTD</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]" title="Registros de hoje ÷ Leads hoje">Conv. Reg</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]"></th>
                </tr>
              </thead>
              <tbody>
                {flowRows.map((row) => {
                  const configKey = chaveLinha(row)
                  const isEditing = editingKey === configKey
                  return (
                    <Fragment key={configKey}>
                      <tr className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors">
                        <td className="py-3 px-3">
                          {row.funil ? (
                            <div className="flex items-center gap-1.5">
                              {row.casas.length > 0 && (
                                <div className="flex -space-x-0.5">
                                  {row.casas.slice(0, 3).map((casaId) => {
                                    const casa = (getState().casasAposta as Record<string, CasaAposta>)[casaId]
                                    return casa ? (
                                      <span
                                        key={casaId}
                                        className="w-2 h-2 rounded-full ring-1 ring-[var(--bg-base)]"
                                        style={{ backgroundColor: casa.cor }}
                                        title={casa.nome}
                                      />
                                    ) : null
                                  })}
                                </div>
                              )}
                              <FunilChip
                                label={row.funil}
                                selecionado={selecionados.has(configKey)}
                                onClick={() => toggleSelecionado(configKey)}
                                cor={(() => {
                                  const primeiraId = row.casas[0]
                                  if (!primeiraId) return undefined
                                  const c = (getState().casasAposta as Record<string, CasaAposta>)[primeiraId]
                                  return c?.cor
                                })()}
                              />
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)]/40 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[var(--text-muted)] text-xs font-mono">{row.botNumero}</span>
                        </td>
                         <td className="py-3 px-3">
                           <div className="text-[var(--text-primary)] font-medium text-sm">{row.flow.nome}</div>
                           {row.flow.triggers.length > 0 && (
                             <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                               {row.flow.triggers.map((t) => t.nome).join(', ')}
                             </div>
                           )}
                         </td>
                         <td className="py-3 px-3">
                           <span className="text-[10px] text-[var(--text-muted)]/60 font-mono truncate block max-w-[140px]" title={row.flow.id}>
                             {row.flow.id}
                           </span>
                         </td>
                        <td className="py-3 px-3">
                          <FlowStatusBadge status={row.flow.status} />
                        </td>
                        <td className="py-3 px-3">
                          {row.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.tags.map((tag) => (
                                <TagChip key={tag} label={tag} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)]/40 italic">sem tags</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {row.carregandoContagens || !row.tags.length ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : (
                            (() => {
                              const f = formatarTempoRelativo(row.ultimoLeadAt)
                              return <span className={`text-xs font-mono ${f.cor}`}>{f.texto}</span>
                            })()
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {row.carregandoContagens ? (
                            <Spinner size={12} />
                          ) : !row.tags.length ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : (
                            <span className={`font-semibold ${row.leadsHoje > 0 ? 'text-[var(--d3)]' : 'text-[var(--text-muted)]'}`}>
                              {row.leadsHoje}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {row.carregandoTotal ? (
                            <Spinner size={12} />
                          ) : !row.tags.length ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : (
                            <span className={`font-semibold ${row.total > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                              {row.total}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!row.utm ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : !trackingLoaded && row.funil && getState().cacheMetricas[row.funil] ? (
                            <span className="font-semibold font-mono text-[var(--text-muted)]/60">
                              {getState().cacheMetricas[row.funil].registros}
                            </span>
                          ) : (
                            <span className={`font-semibold font-mono ${(trackingMap[row.flow.id]?.registros ?? 0) > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                              {trackingMap[row.flow.id]?.registros ?? 0}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!row.utm ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : !trackingLoaded && row.funil && getState().cacheMetricas[row.funil] ? (
                            <span className="font-semibold font-mono text-[var(--text-muted)]/60">
                              {getState().cacheMetricas[row.funil].ftds}
                            </span>
                          ) : (
                            <span className={`font-semibold font-mono ${(trackingMap[row.flow.id]?.ftds ?? 0) > 0 ? 'text-[var(--d1)]' : 'text-[var(--text-muted)]'}`}>
                              {trackingMap[row.flow.id]?.ftds ?? 0}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!row.utm || !row.leadsHoje ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : (
                            <span className="text-xs font-mono text-[var(--text-muted)]">
                              {(((trackingMap[row.flow.id]?.ftds ?? 0) / row.leadsHoje) * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!row.utm || !row.leadsHoje ? (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          ) : (
                            <span className="text-xs font-mono text-[var(--text-muted)]">
                              {(((trackingMap[row.flow.id]?.registros ?? 0) / row.leadsHoje) * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            {row.funil && (
                              <button
                                onClick={() => togglePinFunil(row.funil!)}
                                className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                                title={getState().pinnedFunis.includes(row.funil) ? 'Desafixar da Home' : 'Fixar na Home'}
                              >
                                <Pin size={13} className={getState().pinnedFunis.includes(row.funil) ? 'text-amber-400' : 'text-[var(--text-muted)]/40'} />
                              </button>
                            )}
                            {row.tags.length > 0 && (
                              <button
                                onClick={() => setConversasFluxoKey(configKey)}
                                className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                                title="Ver detalhes e conversas ao vivo"
                              >
                                <Eye size={13} />
                              </button>
                            )}
                            {row.tags.length > 0 && (
                              <button
                                onClick={() => abrirModalApresentarUnico(row)}
                                className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                                title="Apresentar este funil"
                              >
                                <Presentation size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingKey(isEditing ? null : configKey)}
                              className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                              title="Editar funil e tags"
                            >
                              <Pen size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr>
                          <td colSpan={14} className="p-0 border-b border-[var(--glass-border)]">
                            <div className="px-3 py-3">
                              <FlowTagEditor
                                flow={row.flow}
                                botId={row.botId}
                                onSave={() => { setEditingKey(null); setSaveVersion((v) => v + 1) }}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && flowRows.length === 0 && numeros.length > 0 && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum fluxo encontrado.
          </div>
        )}
      </div>

      <Modal open={modalApresentarAberto} onClose={() => setModalApresentarAberto(false)} title="Apresentar dados" width="420px">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Nome da apresentação</label>
            <input
              type="text"
              value={tituloApresentacao}
              onChange={(e) => setTituloApresentacao(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmarApresentar() }}
              autoFocus
              className="w-full h-9 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <button
            onClick={confirmarApresentar}
            disabled={!tituloApresentacao.trim()}
            className="flex items-center justify-center gap-1.5 w-full h-9 rounded-md text-sm font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: 'var(--d1)' }}
          >
            <Presentation size={14} />
            Salvar e abrir
          </button>
        </div>
      </Modal>

      <Modal open={apresentarUnicoRow !== null} onClose={() => setApresentarUnicoRow(null)} title="Apresentar este funil" width="420px">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Nome da apresentação</label>
            <input
              type="text"
              value={tituloApresentacaoUnica}
              onChange={(e) => setTituloApresentacaoUnica(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmarApresentarUnico() }}
              autoFocus
              className="w-full h-9 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <button
            onClick={confirmarApresentarUnico}
            disabled={!tituloApresentacaoUnica.trim() || salvandoApresentacaoUnica}
            className="flex items-center justify-center gap-1.5 w-full h-9 rounded-md text-sm font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: 'var(--d1)' }}
          >
            <Presentation size={14} />
            {salvandoApresentacaoUnica ? 'Salvando...' : 'Salvar e abrir'}
          </button>
        </div>
      </Modal>

      <PainelApresentacoes aberto={painelApresentacoesAberto} onClose={() => setPainelApresentacoesAberto(false)} />

      <PainelConversasFluxo
        key={conversasFluxoKey ?? 'fechado'}
        aberto={conversasFluxoProps !== null}
        onClose={() => setConversasFluxoKey(null)}
        botId={conversasFluxoProps?.botId ?? null}
        flowId={conversasFluxoProps?.flowId ?? null}
        tag={conversasFluxoProps?.tag ?? null}
        flowNome={conversasFluxoProps?.flowNome ?? null}
        tags={conversasFluxoProps?.tags ?? []}
        contagensPorTag={conversasFluxoProps?.contagensPorTag ?? {}}
        cor={conversasFluxoProps?.cor}
        leadsHoje={conversasFluxoProps?.leadsHoje ?? 0}
        total={conversasFluxoProps?.total ?? 0}
        registros={conversasFluxoProps?.registros ?? 0}
        ftds={conversasFluxoProps?.ftds ?? 0}
        periodoLabel={conversasFluxoProps?.periodoLabel ?? ''}
        dataReferencia={conversasFluxoProps?.dataReferencia ?? hojeISO}
        utm={conversasFluxoProps?.utm ?? null}
        utmsExtras={conversasFluxoProps?.utmsExtras ?? []}
      />
    </>
  )
}

export default function FunisPage() {
  return (
    <Suspense>
      <FunisPageInner />
    </Suspense>
  )
}
