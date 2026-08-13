'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { agruparTagsPorBot, contarLeadsIntervalo } from '@/lib/sendpulseLeads'
import { gerarRangeDatas, buscarResultadosDoDia, calcularResultadoLinhaNoDia, tagDeEntradaDoFluxo, type ResultadoDia } from '@/lib/funis'
import { FunilConversaoChart } from '@/components/funis/FunilConversaoChart'
import { LeadConversaCard, type LeadComConversa } from '@/components/funis/LeadConversaCard'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import type { FlowTagConfig, FunilApresentacao } from '@/types'

const MAX_DIAS_APRESENTACAO = 31

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function FunilApresentarUnicoInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [apresentacao, setApresentacao] = useState<FunilApresentacao | null>(null)
  const [config, setConfig] = useState<FlowTagConfig | null>(null)
  const [carregandoBase, setCarregandoBase] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [resultadosPorDia, setResultadosPorDia] = useState<Map<string, ResultadoDia>>(new Map())
  const [leadsPorTag, setLeadsPorTag] = useState<Record<string, number>>({})
  const [carregandoMetricas, setCarregandoMetricas] = useState(true)

  const [leads, setLeads] = useState<LeadComConversa[]>([])
  const [carregandoConversas, setCarregandoConversas] = useState(true)

  const [comentarios, setComentarios] = useState('')
  const [salvandoComentarios, setSalvandoComentarios] = useState(false)

  const { list: casasList } = useCasasAposta()

  // 1. Carrega o registro da apresentação (título, flowId, período, comentários) + a config
  // atual do fluxo (tags/botId/casas — sempre ao vivo, não fica snapshotada).
  useEffect(() => {
    if (!id) return
    let ativo = true
    Promise.all([
      fetch(`/api/funis-apresentacoes?id=${encodeURIComponent(id)}`).then((r) => r.json()),
      fetch('/api/flow-tag-configs').then((r) => r.json()),
    ]).then(([apresData, configsData]) => {
      if (!ativo) return
      if (apresData.error) { setErro(apresData.error); return }
      const apres: FunilApresentacao = apresData.apresentacao
      setApresentacao(apres)
      setComentarios(apres.comentarios ?? '')
      const configs = (configsData.configs ?? []) as FlowTagConfig[]
      setConfig(configs.find((c) => c.flowId === apres.flowId) ?? null)
    }).catch(() => { if (ativo) setErro('Erro ao carregar apresentação') })
      .finally(() => { if (ativo) setCarregandoBase(false) })
    return () => { ativo = false }
  }, [id])

  const datas = useMemo(() => {
    if (!apresentacao) return []
    return gerarRangeDatas(apresentacao.inicio, apresentacao.fim)
  }, [apresentacao])

  const erroIntervalo = datas.length > MAX_DIAS_APRESENTACAO ? `Máximo de ${MAX_DIAS_APRESENTACAO} dias por apresentação` : null

  const tagEntrada = useMemo(() => (config ? tagDeEntradaDoFluxo(config.tags) : undefined), [config])

  // 2. Registros/FTDs por dia (tracking 3CGG) + contagem de leads por tag no intervalo inteiro
  // (usada tanto pro total de leads quanto pro funil de conversão da jornada).
  useEffect(() => {
    if (!config || !apresentacao || datas.length === 0 || erroIntervalo) return
    let ativo = true
    const gruposBotTags = agruparTagsPorBot([{ botId: config.botId, tags: config.tags }])

    Promise.all([
      Promise.all(datas.map((data) => buscarResultadosDoDia(data, gruposBotTags).then((r) => [data, r] as const))),
      contarLeadsIntervalo(gruposBotTags, apresentacao.inicio, apresentacao.fim),
    ]).then(([porDia, porTag]) => {
      if (!ativo) return
      setResultadosPorDia(new Map(porDia))
      setLeadsPorTag(porTag)
    }).finally(() => { if (ativo) setCarregandoMetricas(false) })

    return () => { ativo = false }
  }, [config, apresentacao, datas, erroIntervalo])

  // 3. Últimos leads que passaram por esse fluxo — sempre os mais recentes, não filtrado pelo
  // período da apresentação (é pra validar comportamento atual, não histórico).
  useEffect(() => {
    if (!config || !tagEntrada) return
    let ativo = true
    const params = new URLSearchParams({ botId: config.botId, flowId: config.flowId, tag: tagEntrada, quantidade: '5' })
    fetch(`/api/sendpulse/ultimas-conversas-fluxo?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => { if (ativo) setLeads(data.leads ?? []) })
      .catch(() => {})
      .finally(() => { if (ativo) setCarregandoConversas(false) })
    return () => { ativo = false }
  }, [config, tagEntrada])

  const totais = useMemo(() => {
    let registros = 0
    let ftds = 0
    if (config) {
      for (const dia of resultadosPorDia.values()) {
        const r = calcularResultadoLinhaNoDia(config, dia)
        registros += r.registros
        ftds += r.ftds
      }
    }
    const leadsTotal = tagEntrada ? (leadsPorTag[tagEntrada] ?? 0) : 0
    const convReg = leadsTotal > 0 ? (registros / leadsTotal) * 100 : null
    const convFtd = registros > 0 ? (ftds / registros) * 100 : null
    return { leads: leadsTotal, registros, ftds, convReg, convFtd }
  }, [config, resultadosPorDia, leadsPorTag, tagEntrada])

  const estagios = useMemo(() => {
    if (!config) return []
    return config.tags.map((tag) => ({ tag, contagem: leadsPorTag[tag] ?? 0 }))
  }, [config, leadsPorTag])

  const casaCor = useMemo(() => {
    const primeiraId = config?.casas?.[0]
    if (!primeiraId) return undefined
    return casasList.find((c) => c.id === primeiraId)?.cor
  }, [config, casasList])

  async function salvarComentarios() {
    if (!apresentacao) return
    setSalvandoComentarios(true)
    try {
      await fetch('/api/funis-apresentacoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: apresentacao.id, comentarios }),
      })
      setApresentacao((prev) => (prev ? { ...prev, comentarios } : prev))
    } finally {
      setSalvandoComentarios(false)
    }
  }

  const erroFinal = !id ? 'id é obrigatório na URL' : erro

  if (!erroFinal && carregandoBase) {
    return (
      <div className="h-full w-full flex items-center justify-center gap-2 text-[var(--text-muted)]">
        <Loader2 size={18} className="animate-spin" />
        Carregando...
      </div>
    )
  }

  if (erroFinal || !apresentacao) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-[var(--error)] text-sm">{erroFinal ?? 'Apresentação não encontrada'}</p>
      </div>
    )
  }

  if (erroIntervalo) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-[var(--error)] text-sm">{erroIntervalo}</p>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-[var(--error)] text-sm">Fluxo não encontrado — a configuração de tags desse funil pode ter sido removida.</p>
      </div>
    )
  }

  const periodoLabel = apresentacao.inicio === apresentacao.fim ? apresentacao.inicio : `${apresentacao.inicio} até ${apresentacao.fim}`
  const comentariosMudou = comentarios !== (apresentacao.comentarios ?? '')

  return (
    <div className="min-h-full w-full px-4 py-8 md:px-10 md:py-10">
      <div className="max-w-4xl mx-auto space-y-6 lg:space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{apresentacao.titulo}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {apresentacao.funil || config.funil || config.flowId} · Período: {periodoLabel}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <ResumoTile label="Leads" value={totais.leads} loading={carregandoMetricas} />
          <ResumoTile label="Registros" value={totais.registros} loading={carregandoMetricas} />
          <ResumoTile label="FTDs" value={totais.ftds} loading={carregandoMetricas} />
          <ResumoTile label="Conv. Reg" value={totais.convReg ?? 0} suffix="%" decimals={1} loading={carregandoMetricas} />
          <ResumoTile label="Conv. FTD" value={totais.convFtd ?? 0} suffix="%" decimals={1} loading={carregandoMetricas} />
        </div>

        <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6">
          <h3 className="text-sm lg:text-lg font-semibold text-[var(--text-primary)] mb-1">Insights</h3>
          <p className="text-xs text-[var(--text-muted)] mb-3">Observações sobre a estrutura desse funil — editável direto aqui, salva pra quem abrir esse link depois.</p>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Adicione observações, hipóteses ou próximos passos sobre esse funil..."
            rows={4}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors resize-y"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={salvarComentarios}
              disabled={!comentariosMudou || salvandoComentarios}
              className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: 'var(--d1)' }}
            >
              <Save size={12} />
              {salvandoComentarios ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {config.tags.length > 1 && (
          <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6">
            <h3 className="text-sm lg:text-lg font-semibold text-[var(--text-primary)] mb-3 lg:mb-4">Funil de conversão da jornada</h3>
            {carregandoMetricas ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[var(--text-muted)]" /></div>
            ) : (
              <FunilConversaoChart estagios={estagios} cor={casaCor} />
            )}
          </div>
        )}

        <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6">
          <h3 className="text-sm lg:text-lg font-semibold text-[var(--text-primary)] mb-1">Últimas conversas</h3>
          <p className="text-xs text-[var(--text-muted)] mb-3 lg:mb-4">
            Últimos leads que entraram nesse fluxo (não filtrado pelo período acima) — pra validar tracking e como o lead está se comportando.
          </p>
          {carregandoConversas ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[var(--text-muted)]" /></div>
          ) : leads.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">Nenhuma conversa encontrada pra esse fluxo ainda.</p>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => <LeadConversaCard key={lead.contactId} lead={lead} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResumoTile({ label, value, suffix, decimals, loading }: { label: string; value: number; suffix?: string; decimals?: number; loading?: boolean }) {
  return (
    <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6 text-center flex flex-col items-center gap-1 lg:gap-2">
      {loading ? (
        <Loader2 size={20} className="lg:w-7 lg:h-7 animate-spin text-[var(--text-muted)] my-1" />
      ) : (
        <span className="text-xl md:text-2xl lg:text-4xl font-bold text-[var(--text-primary)]">
          {decimals ? value.toFixed(decimals) : formatInt(value)}
          {suffix ?? ''}
        </span>
      )}
      <span className="text-xs lg:text-sm text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
    </div>
  )
}

export default function FunilApresentarUnicoPage() {
  return (
    <Suspense>
      <FunilApresentarUnicoInner />
    </Suspense>
  )
}
