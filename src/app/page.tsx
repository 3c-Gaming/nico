'use client'

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Pin, RefreshCw, AlertTriangle, Activity, Layers, ChevronDown, ChevronRight, Play, ExternalLink, Link2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { ModalLinkDaxx } from '@/components/home/ModalLinkDaxx'
import { useMonitoramento } from '@/hooks/useMonitoramento'
import { useDisparos } from '@/hooks/useDisparos'
import { getState, togglePinNumero, togglePinFunil } from '@/lib/store'
import type { NumeroMonitorado, FluxoSendpulse, CasaAposta, DisparoDaxx, Disparo, TemplateDaxx } from '@/types'

const POLL_FUNIL_MS = 30_000

function getLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface BotTestApiResult {
  botId: string
  nome?: string
  status: string
  ultimoTeste?: string
  erro?: string
  duracaoMs?: number
  pendente?: boolean
  ultimoTesteOkMs?: number
  ultimoTriggerOkMs?: number
}

const TESTE_STATUS: Record<string, { label: string; cor: string; dot: string }> = {
  ok: { label: 'Online', cor: 'text-green-500', dot: 'bg-green-500' },
  erro: { label: 'Erro', cor: 'text-red-500', dot: 'bg-red-500' },
  sem_resposta: { label: 'Sem resposta', cor: 'text-amber-400', dot: 'bg-amber-400' },
  pendente: { label: 'Testando...', cor: 'text-blue-400', dot: 'bg-blue-400' },
}

function formatTempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'agora'
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function TesteStatusBadge({ resultado }: { resultado?: BotTestApiResult }) {
  if (!resultado) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
        <span className="inline-block w-2 h-2 rounded-full bg-[var(--text-muted)]/30" />
        Sem teste
      </span>
    )
  }
  const cfg = TESTE_STATUS[resultado.status] ?? TESTE_STATUS.pendente
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.cor}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {resultado.ultimoTeste && (
        <span className="text-[10px] text-[var(--text-muted)] ml-1">{formatTempoRelativo(resultado.ultimoTeste)}</span>
      )}
      {resultado.erro && (
        <span className="text-[10px] text-[var(--error)] ml-1 truncate max-w-[120px]" title={resultado.erro}>{resultado.erro}</span>
      )}
    </span>
  )
}

function UltimaResposta({ ultimoAumentoMs }: { ultimoAumentoMs?: number }) {
  if (!ultimoAumentoMs) return <span className="text-xs text-[var(--text-muted)]/50">—</span>
  const diff = Date.now() - ultimoAumentoMs
  if (diff < 60000) return <span className="text-xs text-green-500 font-medium">agora</span>
  if (diff < 3600000) return <span className="text-xs text-green-500 font-medium">há {Math.floor(diff / 60000)}min</span>
  if (diff < 86400000) return <span className="text-xs text-amber-400 font-medium">há {Math.floor(diff / 3600000)}h</span>
  return <span className="text-xs text-[var(--text-muted)]">{new Date(ultimoAumentoMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
}

function formatarTempoRelativo(iso: string | null): { texto: string; cor: string } {
  if (!iso) return { texto: '—', cor: 'text-[var(--text-muted)]/40' }
  const agora = Date.now()
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return { texto: iso, cor: 'text-[var(--text-muted)]' }
  const diffMs = agora - ts
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffMin < 5) return { texto: 'agora', cor: 'text-green-400' }
  if (diffMin < 60) return { texto: `há ${diffMin}min`, cor: 'text-amber-400' }
  if (diffH < 24) return { texto: `há ${diffH}h`, cor: 'text-amber-400/70' }
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return { texto: `${dd}/${mm} ${hh}:${mi}`, cor: 'text-[var(--text-muted)]/60' }
}

interface FunilBotDetail {
  botId: string
  botNome: string
  flowNomes: string[]
  flowIds: string[]
  lpUrls: string[]
  tags: string[]
  leadsHoje: number
  baseCusto: number
  baseLinhas: number
  ultimoLeadAt: string | null
  registros: number
  ftds: number
  entregues: number
  lidas: number
}

interface FunilRow {
  funilNome: string
  botNomes: string[]
  tags: string[]
  casas: string[]
  corBadge?: string
  lpUrls: string[]
  leadsHoje: number
  baseCusto: number
  baseLinhas: number
  ultimoLeadAt: string | null
  registros: number
  ftds: number
  entregues: number
  lidas: number
  custoPorReg: number
  custoPorFtd: number
  regParaFtd: number
  bots: FunilBotDetail[]
  tipo: 'traffic' | 'disparo'
}

export default function HomePage() {
  const router = useRouter()
  const { data: monitoramento, loading, refreshing, error, atualizar, proximaAtualizacao, botTestMap } = useMonitoramento()
  const { list: todosDisparos, update: updateDisparo } = useDisparos()
  const [contagens, setContagens] = useState<Record<string, number>>({})
  const [ultimoLeadMap, setUltimoLeadMap] = useState<Record<string, string | null>>({})
  const [fluxosMap, setFluxosMap] = useState<Record<string, FluxoSendpulse[]>>({})
  const [carregandoFunis, setCarregandoFunis] = useState(false)
  const [pinVersion, setPinVersion] = useState(0)
  const [pinnedNumeros, setPinnedNumeros] = useState<string[]>([])
  const [pinnedFunis, setPinnedFunis] = useState<string[]>([])
  const [trackingMap, setTrackingMap] = useState<Record<string, { registros: number; ftds: number }>>({})
  const [trackingData, setTrackingData] = useState(getLocalDate())
  const [expandedFunis, setExpandedFunis] = useState<Record<string, boolean>>({})
  const [modalLinkFunil, setModalLinkFunil] = useState<string | null>(null)
  const [liveLeadsLoaded, setLiveLeadsLoaded] = useState(false)
  const [liveTrackingLoaded, setLiveTrackingLoaded] = useState(false)
  const [daxxCampanhas, setDaxxCampanhas] = useState<DisparoDaxx[]>([])
  const [daxxLoaded, setDaxxLoaded] = useState(false)
  const [testandoBotId, setTestandoBotId] = useState<string | null>(null)
  const [flowTagConfigsVersion, setFlowTagConfigsVersion] = useState(0)

  useEffect(() => {
    const s = getState()
    setPinnedNumeros(s.pinnedNumeros)
    setPinnedFunis(s.pinnedFunis)
  }, [])

  const forceUpdate = useCallback(() => {
    const s = getState()
    setPinnedNumeros(s.pinnedNumeros)
    setPinnedFunis(s.pinnedFunis)
    setFlowTagConfigsVersion((v) => v + 1)
    setPinVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    const handler = () => forceUpdate()
    window.addEventListener('nico:state-changed', handler)
    window.addEventListener('nico:data-loaded', handler)
    return () => {
      window.removeEventListener('nico:state-changed', handler)
      window.removeEventListener('nico:data-loaded', handler)
    }
  }, [forceUpdate])

  const numerosPinados = useMemo(() => {
    if (!monitoramento?.numeros) return []
    return monitoramento.numeros.filter((n) => pinnedNumeros.includes(n.numero.id))
  }, [monitoramento?.numeros, pinnedNumeros, pinVersion])

  useEffect(() => {
    if (!pinnedFunis.length) return
    const configs = getState().flowTagConfigs
    const relevantFlowIds = Object.entries(configs)
      .filter(([_, c]) => c.funil && pinnedFunis.includes(c.funil))
      .map(([flowId]) => flowId)
    if (!relevantFlowIds.length) return
    const botIds = [...new Set(relevantFlowIds.map((fid) => configs[fid].botId))]
    const allTags = [...new Set(relevantFlowIds.flatMap((fid) => configs[fid].tags ?? []))]

    async function fetchData() {
      setCarregandoFunis(true)
      try {
        const fluxosPromises = botIds.map(async (botId) => {
          try {
            const res = await fetch(`/api/sendpulse/fluxos?bot_id=${encodeURIComponent(botId)}`)
            if (res.ok) {
              const data = await res.json()
              return { botId, fluxos: data.fluxos as FluxoSendpulse[] }
            }
          } catch { /* noop */ }
          return { botId, fluxos: [] as FluxoSendpulse[] }
        })
        const fluxosResults = await Promise.allSettled(fluxosPromises)
        const novo: Record<string, FluxoSendpulse[]> = {}
        for (const r of fluxosResults) {
          if (r.status === 'fulfilled') novo[r.value.botId] = r.value.fluxos
        }
        setFluxosMap(novo)

        if (allTags.length) {
          const res = await fetch('/api/leadhub/contagem-por-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: allTags }),
          })
          if (res.ok) {
            const data = await res.json()
            const leads = data.leads ?? {}
            setContagens(leads)
            setUltimoLeadMap(data.ultimoLead ?? {})
            setLiveLeadsLoaded(true)
          }
        }
      } catch { /* noop */ } finally {
        setCarregandoFunis(false)
      }
    }

    async function fetchTracking() {
      const flowIdsComUtm = Object.entries(configs).filter(
        ([fid, c]) => c.utm && c.funil && pinnedFunis.includes(c.funil),
      )
      if (!flowIdsComUtm.length) return

      const [superbetRes, betmgmRes] = await Promise.all([
        fetch(`/api/tracking/export?casa=superbet&date=${trackingData}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/tracking/export?casa=betmgm&date=${trackingData}`).then((r) => r.json()).catch(() => ({})),
      ])
      const novo: Record<string, { registros: number; ftds: number }> = {}
      for (const [fid, c] of flowIdsComUtm) {
        const utm = c.utm!
        let registros = 0
        let ftds = 0
        for (const item of (superbetRes as any)?.data ?? []) {
          if (String(item.acid).includes(utm)) {
            registros += item.registrations ?? 0
            ftds += item.ftds ?? 0
          }
        }
        for (const item of (betmgmRes as any)?.data ?? []) {
          if (String(item.marketing_source_id) === utm) {
            registros += item.registrations ?? 0
            ftds += item.ftds ?? 0
          }
        }
        novo[fid] = { registros, ftds }
      }
      setTrackingMap(novo)
      setLiveTrackingLoaded(true)
    }

    async function fetchDaxx() {
      try {
        const res = await fetch('/api/daxx/campanhas')
        if (res.ok) {
          const data = await res.json()
          setDaxxCampanhas(data.campanhas ?? [])
          setDaxxLoaded(true)
        }
      } catch { /* noop */ }
    }

    fetchData()
    fetchTracking()
    fetchDaxx()
    const interval = setInterval(() => { fetchData(); fetchTracking(); fetchDaxx() }, POLL_FUNIL_MS)
    return () => clearInterval(interval)
  }, [pinnedFunis, pinVersion, trackingData, flowTagConfigsVersion])

  const handleTestarBot = useCallback(async (botId: string) => {
    if (testandoBotId) return
    setTestandoBotId(botId)
    try {
      const res = await fetch('/api/bot-test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      })
      if (!res.ok) throw new Error()
      await atualizar()
    } catch {
    } finally {
      setTestandoBotId(null)
    }
  }, [testandoBotId, atualizar])

  const funilRows = useMemo<FunilRow[]>(() => {
    if (!pinnedFunis.length) return []
    const configs = getState().flowTagConfigs

    return pinnedFunis.map((funilNome) => {
      const flowIdsValidos = new Set(Object.values(fluxosMap).flat().map(f => f.id))
      const flows = Object.entries(configs).filter(([_, c]) => c.funil === funilNome && flowIdsValidos.has(c.flowId))
      const tags = [...new Set(flows.flatMap(([_, c]) => c.tags ?? []))]
      const botIds = [...new Set(flows.map(([_, c]) => c.botId))]
      const cache = getState().cacheMetricas[funilNome]

      const leadsHoje = liveLeadsLoaded
        ? tags.reduce((acc, t) => acc + (contagens[t] ?? 0), 0)
        : (cache?.leadsHoje ?? 0)
      const ultimoLeadAt = tags.reduce<string | null>((best, t) => {
        const ts = ultimoLeadMap[t] ?? null
        if (!ts) return best
        if (!best || ts > best) return ts
        return best
      }, null)

      // determine tipo from flows
      const flowTipos = flows.map(([_, c]) => c.tipo ?? 'disparo')
      const tipo = flowTipos.includes('traffic') ? 'traffic' as const : 'disparo' as const

      const botNomes = [...new Set(botIds.map((botId) => {
        const found = monitoramento?.numeros.find((n) => n.numero.id === botId)
        return found?.numero.numero ?? botId
      }))]

      const registros = liveTrackingLoaded
        ? flows.reduce((acc, [fid]) => acc + (trackingMap[fid]?.registros ?? 0), 0)
        : (cache?.registros ?? 0)
      const ftds = liveTrackingLoaded
        ? flows.reduce((acc, [fid]) => acc + (trackingMap[fid]?.ftds ?? 0), 0)
        : (cache?.ftds ?? 0)

      // per-bot breakdown (also carries UTM info for base cost matching)
      const porBot = new Map<string, { flowIds: string[]; tagsSet: Set<string>; utms: Set<string> }>()
      for (const [flowId, c] of flows) {
        if (!porBot.has(c.botId)) porBot.set(c.botId, { flowIds: [], tagsSet: new Set(), utms: new Set() })
        const bot = porBot.get(c.botId)!
        bot.flowIds.push(flowId)
        for (const tag of (c.tags ?? [])) bot.tagsSet.add(tag)
        if (c.utm) bot.utms.add(c.utm)
      }

      // base cost via UTM matching
      // pre-compute how many funis each UTM reaches (across ALL configs)
      const utmParaFunis = new Map<string, Set<string>>()
      for (const c of Object.values(configs)) {
        if (c.utm && c.funil) {
          if (!utmParaFunis.has(c.utm)) utmParaFunis.set(c.utm, new Set())
          utmParaFunis.get(c.utm)!.add(c.funil)
        }
      }

      const disparos = Object.values(getState().disparos)
      const funilUtms = new Set(flows.map(([_, c]) => c.utm).filter(Boolean) as string[])
      const disparosDoFunil = disparos.filter((d) => d.utm && funilUtms.has(d.utm))

      const baseCustoPorBot = new Map<string, number>()
      const baseLinhasPorBot = new Map<string, number>()
      for (const botId of porBot.keys()) {
        baseCustoPorBot.set(botId, 0)
        baseLinhasPorBot.set(botId, 0)
      }

      for (const d of disparosDoFunil) {
        const baseLinhas = d.base?.totalRegistros ?? 0
        const custoTotal = baseLinhas * 0.13
        const numFunis = utmParaFunis.get(d.utm!)?.size ?? 1
        const custoPorFunil = custoTotal / numFunis
        const linhasPorFunil = baseLinhas / numFunis

        const matchingBots = [...porBot.entries()]
          .filter(([_, data]) => data.utms.has(d.utm!))
          .map(([botId]) => botId)
        if (matchingBots.length > 0) {
          const shareCusto = custoPorFunil / matchingBots.length
          const shareLinhas = linhasPorFunil / matchingBots.length
          for (const botId of matchingBots) {
            baseCustoPorBot.set(botId, (baseCustoPorBot.get(botId) ?? 0) + shareCusto)
            baseLinhasPorBot.set(botId, (baseLinhasPorBot.get(botId) ?? 0) + shareLinhas)
          }
        }
      }

      const baseCusto = [...baseCustoPorBot.values()].reduce((a, b) => a + b, 0)
      const baseLinhas = Math.round([...baseLinhasPorBot.values()].reduce((a, b) => a + b, 0))

      // DAXX entregues/lidas via templateDaxx.id match
      const daxxPorId = new Map(daxxCampanhas.map((c) => [c.id, c]))
      const entreguesPorBot = new Map<string, number>()
      const lidasPorBot = new Map<string, number>()
      for (const botId of porBot.keys()) {
        entreguesPorBot.set(botId, 0)
        lidasPorBot.set(botId, 0)
      }
      for (const d of disparosDoFunil) {
        if (d.templateDaxx?.id) {
          const daxx = daxxPorId.get(d.templateDaxx.id)
          if (daxx) {
            const numFunis = utmParaFunis.get(d.utm!)?.size ?? 1
            const entPorFunil = daxx.entregues / numFunis
            const lidPorFunil = daxx.lidas / numFunis
            const matchingBots = [...porBot.entries()]
              .filter(([_, data]) => data.utms.has(d.utm!))
              .map(([botId]) => botId)
            if (matchingBots.length > 0) {
              const shareEnt = entPorFunil / matchingBots.length
              const shareLid = lidPorFunil / matchingBots.length
              for (const botId of matchingBots) {
                entreguesPorBot.set(botId, (entreguesPorBot.get(botId) ?? 0) + shareEnt)
                lidasPorBot.set(botId, (lidasPorBot.get(botId) ?? 0) + shareLid)
              }
            }
          }
        }
      }
      const entreguesTotal = [...entreguesPorBot.values()].reduce((a, b) => a + b, 0)
      const lidasTotal = [...lidasPorBot.values()].reduce((a, b) => a + b, 0)
      const custoPorReg = registros > 0 ? Math.round((baseCusto / registros) * 100) / 100 : 0
      const custoPorFtd = ftds > 0 ? Math.round((baseCusto / ftds) * 100) / 100 : 0
      const regParaFtd = registros > 0 ? Math.round((ftds / registros) * 10000) / 100 : 0

      // collect unique casas and first casa color for badge
      const casas = [...new Set(flows.flatMap(([fid]) => configs[fid]?.casas ?? []))]
      const allLpUrls = [...new Set(flows.map(([fid]) => configs[fid]?.lpUrl).filter(Boolean) as string[])]
      const primeiraCasaId = casas[0]
      const corBadge = primeiraCasaId ? (getState().casasAposta as Record<string, CasaAposta>)[primeiraCasaId]?.cor : undefined
      const fluxosPorBot = fluxosMap
      const monitoramentoNum = monitoramento?.numeros ?? []
      const bots: FunilBotDetail[] = [...porBot.entries()].map(([botId, data]) => {
        const botTags = [...data.tagsSet]
        const botFluxos = fluxosPorBot[botId]?.filter((f) => data.flowIds.includes(f.id)) ?? []
        const botLpUrls = data.flowIds.map((fid) => configs[fid]?.lpUrl).filter(Boolean) as string[]
        const found = monitoramentoNum.find((n) => n.numero.id === botId)
        const botNome = found?.numero.numero ?? botId
        return {
          botId,
          botNome,
          flowNomes: botFluxos.map((f) => f.nome).filter(Boolean),
          flowIds: data.flowIds,
          lpUrls: botLpUrls,
          tags: botTags,
          leadsHoje: liveLeadsLoaded
            ? botTags.reduce((acc, t) => acc + (contagens[t] ?? 0), 0)
            : (cache?.leadsHoje ?? 0),
          baseCusto: Math.round(((baseCustoPorBot.get(botId) ?? 0) + Number.EPSILON) * 100) / 100,
          baseLinhas: Math.round(baseLinhasPorBot.get(botId) ?? 0),
          ultimoLeadAt: botTags.reduce<string | null>((best, t) => {
            const ts = ultimoLeadMap[t] ?? null
            if (!ts) return best
            if (!best || ts > best) return ts
            return best
          }, null),
          registros: liveTrackingLoaded
            ? data.flowIds.reduce((acc, fid) => acc + (trackingMap[fid]?.registros ?? 0), 0)
            : (cache?.registros ?? 0),
          ftds: liveTrackingLoaded
            ? data.flowIds.reduce((acc, fid) => acc + (trackingMap[fid]?.ftds ?? 0), 0)
            : (cache?.ftds ?? 0),
          entregues: Math.round(entreguesPorBot.get(botId) ?? 0),
          lidas: Math.round(lidasPorBot.get(botId) ?? 0),
        }
      })

      return { funilNome, botNomes, tags, casas, corBadge, lpUrls: allLpUrls, leadsHoje, baseCusto: Math.round((baseCusto + Number.EPSILON) * 100) / 100, baseLinhas, ultimoLeadAt, registros, ftds, entregues: Math.round(entreguesTotal), lidas: Math.round(lidasTotal), custoPorReg, custoPorFtd, regParaFtd, bots, tipo }
    })
  }, [pinnedFunis, contagens, ultimoLeadMap, monitoramento?.numeros, pinVersion, trackingMap, fluxosMap, daxxCampanhas])

  const temPinos = pinnedNumeros.length > 0 || pinnedFunis.length > 0

  const disparoRows = funilRows.filter((r) => r.tipo === 'disparo')
  const trafficRows = funilRows.filter((r) => r.tipo === 'traffic')

  const disparosDoModal = useMemo<Disparo[]>(() => {
    if (!modalLinkFunil) return []
    const configs = getState().flowTagConfigs
    const funilUtms = new Set(
      Object.values(configs)
        .filter((c) => c.funil === modalLinkFunil && c.utm)
        .map((c) => c.utm as string)
    )
    return todosDisparos.filter((d) => d.utm && funilUtms.has(d.utm))
  }, [modalLinkFunil, todosDisparos])

  function handleLinkDaxx(disparoId: string, templateDaxx: TemplateDaxx | undefined) {
    updateDisparo(disparoId, { templateDaxx } as Partial<Disparo>)
  }

  function handleToggleFunil(nome: string) {
    togglePinFunil(nome)
    forceUpdate()
  }

  function toggleExpand(funilNome: string) {
    setExpandedFunis((prev) => ({ ...prev, [funilNome]: !prev[funilNome] }))
  }

  function renderFunilRows(rows: FunilRow[], tipo: 'disparo' | 'traffic') {
    const isDisparo = tipo === 'disparo'
    return rows.map((row) => (
      <Fragment key={row.funilNome}>
        <tr className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors">
          <td className="py-3 px-3">
            <div className="flex items-center gap-1.5">
              {row.bots.length > 1 && (
                <button
                  onClick={() => toggleExpand(row.funilNome)}
                  className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                  title={expandedFunis[row.funilNome] ? 'Recolher' : 'Expandir'}
                >
                  {expandedFunis[row.funilNome] ? <ChevronDown size={14} className="text-[var(--text-muted)]" /> : <ChevronRight size={14} className="text-[var(--text-muted)]" />}
                </button>
              )}
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
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono"
                style={{
                  backgroundColor: `${row.corBadge ?? 'var(--d1)'}20`,
                  border: `1px solid ${row.corBadge ?? 'var(--d1)'}30`,
                  color: row.corBadge ?? 'var(--d1)',
                }}
              >
                {row.funilNome}
              </span>
              <button
                onClick={() => handleToggleFunil(row.funilNome)}
                className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                title="Desafixar da Home"
              >
                <Pin size={11} className="text-amber-400" />
              </button>
            </div>
          </td>
          <td className="py-3 px-3">
            <div className="flex flex-wrap gap-1">
              {row.botNomes.length === 0 ? (
                <span className="text-xs text-[var(--text-muted)]/40">—</span>
              ) : (
                row.botNomes.map((nome) => (
                  <span key={nome} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)]">
                    {nome}
                  </span>
                ))
              )}
            </div>
          </td>
          <td className="py-3 px-3 text-right">
            <span className={`font-semibold ${row.leadsHoje > 0 ? 'text-[var(--d3)]' : 'text-[var(--text-muted)]'}`}>
              {row.leadsHoje}
            </span>
          </td>
          {isDisparo && (
            <>
              <td className="py-3 px-3 text-right">
                <span className={`font-semibold font-mono ${row.baseLinhas > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {row.baseLinhas > 0 ? row.baseLinhas.toLocaleString('pt-BR') : '—'}
                </span>
              </td>
              <td className="py-3 px-3 text-right">
                <span
                  className={`font-semibold font-mono ${row.baseCusto > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}
                  title={row.baseLinhas > 0 ? `${row.baseLinhas.toLocaleString('pt-BR')} linhas` : undefined}
                >
                  {row.baseCusto > 0 ? `R$ ${row.baseCusto.toFixed(2).replace('.', ',')}` : '—'}
                </span>
              </td>
            </>
          )}
          {isDisparo && (
            <>
              <td className="py-3 px-3 text-right">
                <span className={`font-semibold font-mono ${row.entregues > 0 ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
                  {row.entregues > 0 ? row.entregues.toLocaleString('pt-BR') : '—'}
                </span>
              </td>
              <td className="py-3 px-3 text-right">
                <span className={`font-semibold font-mono ${row.lidas > 0 ? 'text-[var(--d1)]' : 'text-[var(--text-muted)]'}`}>
                  {row.lidas > 0 ? row.lidas.toLocaleString('pt-BR') : '—'}
                </span>
              </td>
              <td className="py-3 px-3 text-right">
                <span className={`font-semibold font-mono ${row.regParaFtd > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {row.regParaFtd > 0 ? `${row.regParaFtd}%` : '—'}
                </span>
              </td>
              <td className="py-3 px-3 text-right">
                <span className={`font-semibold font-mono ${row.custoPorReg > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                  {row.custoPorReg > 0 ? `R$ ${row.custoPorReg.toFixed(2).replace('.', ',')}` : '—'}
                </span>
              </td>
              <td className="py-3 px-3 text-right">
                <span className={`font-semibold font-mono ${row.custoPorFtd > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                  {row.custoPorFtd > 0 ? `R$ ${row.custoPorFtd.toFixed(2).replace('.', ',')}` : '—'}
                </span>
              </td>
            </>
          )}
          <td className="py-3 px-3 text-right">
            <span className={`font-semibold font-mono ${row.registros > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              {row.registros}
            </span>
          </td>
          <td className="py-3 px-3 text-right">
            <span className={`font-semibold font-mono ${row.ftds > 0 ? 'text-[var(--d1)]' : 'text-[var(--text-muted)]'}`}>
              {row.ftds}
            </span>
          </td>
          <td className="py-3 px-3">
            <span className={`text-xs font-mono ${formatarTempoRelativo(row.ultimoLeadAt).cor}`}>
              {formatarTempoRelativo(row.ultimoLeadAt).texto}
            </span>
          </td>
          <td className="py-3 px-3 text-right">
            <div className="flex items-center justify-end gap-2">
              {isDisparo && (
                <button
                  onClick={() => setModalLinkFunil(row.funilNome)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--d1)] hover:bg-[var(--d1)]/10 transition-colors"
                  title="Linkar disparos a campanhas DAXX"
                >
                  <Link2 size={11} />
                  DAXX
                </button>
              )}
              <button
                onClick={() => router.push(`/funis?busca=${encodeURIComponent(row.funilNome)}`)}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline transition-colors"
              >
                ver fluxos
              </button>
            </div>
          </td>
        </tr>
        {row.bots.length > 1 && expandedFunis[row.funilNome] && (
          <tr key={`${row.funilNome}-expand`}>
            <td colSpan={isDisparo ? 14 : 7} className="p-0">
              <div className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--glass-border)]/50">
                      <th className="text-left py-2 px-3 pl-8 text-[10px] font-medium text-[var(--text-muted)]">Número</th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Fluxos</th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Tags</th>
                      <th className="text-right py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Leads hoje</th>
                      {isDisparo && (
                        <>
                          <th className="text-right py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Base</th>
                          <th className="text-right py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Custo/Gasto</th>
                          <th className="text-right py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Entregues</th>
                          <th className="text-right py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Lidas</th>
                        </>
                      )}
                      <th className="text-right py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Reg</th>
                      <th className="text-right py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">FTDs</th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-[var(--text-muted)]">Último lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.bots.map((bot) => (
                      <tr key={bot.botId} className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)]/30 hover:bg-[var(--glass-hover-bg)] transition-colors">
                        <td className="py-2 px-3 pl-8">
                          <span className="font-mono text-[var(--text-primary)]">{bot.botNome}</span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-0.5">
                            {bot.flowNomes.length === 0 ? (
                              <span className="text-[var(--text-muted)]/40">—</span>
                            ) : (
                              bot.flowNomes.map((fn, i) => (
                                <span key={fn} className="inline-flex items-center px-1 py-0.5 rounded text-[10px] bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]" title={bot.flowIds[i]}>
                                  {fn}
                                </span>
                              ))
                            )}
                          </div>
                          {bot.flowIds.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {bot.flowIds.map((fid) => (
                                <span key={fid} className="text-[9px] text-[var(--text-muted)]/40 font-mono truncate max-w-[120px] block" title={fid}>
                                  {fid}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-0.5">
                            {bot.tags.length === 0 ? (
                              <span className="text-[var(--text-muted)]/40">—</span>
                            ) : (
                              bot.tags.map((t) => (
                                <span key={t} className="inline-flex items-center px-1 py-0.5 rounded text-[10px] bg-[var(--d3)]/10 border border-[var(--d3)]/20 text-[var(--d3)]">
                                  {t}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-semibold ${bot.leadsHoje > 0 ? 'text-[var(--d3)]' : 'text-[var(--text-muted)]'}`}>{bot.leadsHoje}</span>
                        </td>
                        {isDisparo && (
                          <>
                            <td className="py-2 px-3 text-right">
                              <span className={`font-semibold font-mono ${bot.baseLinhas > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                                {bot.baseLinhas > 0 ? bot.baseLinhas.toLocaleString('pt-BR') : '—'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span
                                className={`font-semibold font-mono ${bot.baseCusto > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}
                                title={bot.baseLinhas > 0 ? `${bot.baseLinhas.toLocaleString('pt-BR')} linhas` : undefined}
                              >
                                {bot.baseCusto > 0 ? `R$ ${bot.baseCusto.toFixed(2).replace('.', ',')}` : '—'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className={`font-semibold font-mono ${bot.entregues > 0 ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
                                {bot.entregues > 0 ? bot.entregues.toLocaleString('pt-BR') : '—'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className={`font-semibold font-mono ${bot.lidas > 0 ? 'text-[var(--d1)]' : 'text-[var(--text-muted)]'}`}>
                                {bot.lidas > 0 ? bot.lidas.toLocaleString('pt-BR') : '—'}
                              </span>
                            </td>
                          </>
                        )}
                        <td className="py-2 px-3 text-right">
                          <span className={`font-semibold font-mono ${bot.registros > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{bot.registros}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-semibold font-mono ${bot.ftds > 0 ? 'text-[var(--d1)]' : 'text-[var(--text-muted)]'}`}>{bot.ftds}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs font-mono ${formatarTempoRelativo(bot.ultimoLeadAt).cor}`}>
                            {formatarTempoRelativo(bot.ultimoLeadAt).texto}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    ))
  }

  return (
    <>
      <PageHeader
        titulo="Home"
        descricao="Monitoramento rápido dos itens fixados"
        acoes={
          <div className="flex items-center gap-2">
            <button
              onClick={atualizar}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </button>
            <span className="text-xs text-[var(--text-muted)] tabular-nums w-10 text-right">
              {proximaAtualizacao}s
            </span>
          </div>
        }
      />

      <div className="p-6 space-y-8">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {!temPinos && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Pin size={40} className="text-[var(--text-muted)]/20 mb-4" />
            <p className="text-sm text-[var(--text-muted)] mb-2">
              Nenhum item fixado ainda.
            </p>
            <p className="text-xs text-[var(--text-muted)]/60 mb-6">
              Fixe números e funis para monitorar em tempo real.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/numeros')}
                className="px-4 h-9 rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--d1)' }}
              >
                Ir para Números
              </button>
              <button
                onClick={() => router.push('/funis')}
                className="px-4 h-9 rounded-md text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Ir para Funis
              </button>
            </div>
          </div>
        )}

        {pinnedNumeros.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Activity size={16} className="text-[var(--d1)]" />
                Números Fixados
                <span className="text-xs font-normal text-[var(--text-muted)]">{pinnedNumeros.length}</span>
              </h2>
              {!loading && (
                <span className="text-xs text-[var(--text-muted)]">
                  {refreshing ? 'recarregando...' : '✓ ao vivo'}
                </span>
              )}
            </div>

            <div className={`grid gap-3 ${pinnedNumeros.length < 4 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {numerosPinados.map((item) => (
                <div
                  key={item.numero.id}
                  className="rounded-lg glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] p-4 space-y-3 hover:bg-[var(--glass-hover-bg)] hover:shadow-[var(--glass-hover-shadow)] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${item.numero.status === 'ativo' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{item.numero.nome}</div>
                        <div className="text-xs text-[var(--text-muted)] font-mono truncate">{item.numero.numero}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { togglePinNumero(item.numero.id); forceUpdate() }}
                      className="shrink-0 p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                      title="Desafixar"
                    >
                      <Pin size={14} className="text-amber-400" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Layers size={12} className="text-[var(--text-muted)]" />
                      <span className="text-[var(--text-primary)] font-semibold">{item.totalFluxos}</span>
                      <span className="text-[var(--text-muted)]">fluxos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[var(--text-muted)]">msgs:</span>
                      <span className="text-[var(--text-primary)] font-semibold">{item.totalMensagensEnviadas}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/50">
                    <div className="flex items-center gap-2">
                      <TesteStatusBadge resultado={botTestMap.get(item.numero.id)} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTestarBot(item.numero.id) }}
                        disabled={testandoBotId === item.numero.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--d1)]/20 text-[var(--text-muted)] hover:text-[var(--d1)] disabled:opacity-40 transition-colors"
                        title="Testar bot"
                      >
                        {testandoBotId === item.numero.id ? (
                          <RefreshCw size={10} className="animate-spin" />
                        ) : (
                          <Play size={10} />
                        )}
                        Testar
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span>última:</span>
                      <UltimaResposta ultimoAumentoMs={item.ultimoAumentoMs} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {pinnedFunis.length > 0 && (
          <>
            {disparoRows.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers size={16} className="text-[var(--d1)]" />
                    Disparo
                    <span className="text-xs font-normal text-[var(--text-muted)]">{disparoRows.length}</span>
                  </h2>
                  {carregandoFunis && <Spinner size={12} />}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--glass-border)]">
                        <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Funil</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Bots</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Leads hoje</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Base</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Custo/Gasto</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Entregues</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Lidas</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Reg/FTD</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Custo/Reg</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Custo/FTD</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Reg</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">FTDs</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Último lead</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderFunilRows(disparoRows, 'disparo')}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {trafficRows.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers size={16} className="text-[var(--d1)]" />
                    Tráfego
                    <span className="text-xs font-normal text-[var(--text-muted)]">{trafficRows.length}</span>
                  </h2>
                  {carregandoFunis && <Spinner size={12} />}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--glass-border)]">
                        <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Funil</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Bots</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Leads hoje</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Reg</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">FTDs</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Último lead</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderFunilRows(trafficRows, 'traffic')}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <ModalLinkDaxx
        open={modalLinkFunil !== null}
        funilNome={modalLinkFunil}
        disparos={disparosDoModal}
        campanhas={daxxCampanhas}
        onLink={handleLinkDaxx}
        onClose={() => setModalLinkFunil(null)}
      />
    </>
  )
}
