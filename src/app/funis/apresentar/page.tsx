'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { agruparTagsPorBot } from '@/lib/sendpulseLeads'
import { gerarRangeDatas, buscarResultadosDoDia, calcularResultadoLinhaNoDia, type ResultadoDia } from '@/lib/funis'
import type { FlowTagConfig } from '@/types'

const MAX_DIAS_EXPORT_INTERVALO = 31

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatPercent(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`
}

function formatDataExtenso(data: string): string {
  const d = new Date(`${data}T00:00:00`)
  const texto = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

interface LinhaConfig extends FlowTagConfig {
  nomeFunil: string
}

function FunisApresentarInner() {
  const searchParams = useSearchParams()
  const flowIds = useMemo(() => (searchParams.get('flows') ?? '').split(',').filter(Boolean), [searchParams])
  const inicio = searchParams.get('inicio') ?? ''
  const fim = searchParams.get('fim') ?? ''

  const [linhas, setLinhas] = useState<LinhaConfig[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resultadosPorDia, setResultadosPorDia] = useState<Map<string, ResultadoDia>>(new Map())
  const [carregandoConfig, setCarregandoConfig] = useState(true)

  const datas = useMemo(() => {
    if (!inicio || !fim) return []
    return gerarRangeDatas(inicio, fim)
  }, [inicio, fim])

  const erroIntervalo = datas.length > MAX_DIAS_EXPORT_INTERVALO
    ? `Máximo de ${MAX_DIAS_EXPORT_INTERVALO} dias por apresentação`
    : null

  useEffect(() => {
    let ativo = true
    fetch('/api/flow-tag-configs')
      .then((r) => r.json())
      .then((data) => {
        if (!ativo) return
        const configs = (data.configs ?? []) as FlowTagConfig[]
        const porFlowId = new Map(configs.map((c) => [c.flowId, c]))
        const resolvidas: LinhaConfig[] = []
        for (const flowId of flowIds) {
          const cfg = porFlowId.get(flowId)
          if (cfg) resolvidas.push({ ...cfg, nomeFunil: cfg.funil ?? cfg.flowId })
        }
        setLinhas(resolvidas)
      })
      .catch(() => {
        if (ativo) setErro('Erro ao carregar configuração dos funis')
      })
      .finally(() => {
        if (ativo) setCarregandoConfig(false)
      })
    return () => { ativo = false }
  }, [flowIds])

  useEffect(() => {
    if (!linhas || linhas.length === 0 || datas.length === 0 || erroIntervalo) return
    let ativo = true
    const gruposBotTags = agruparTagsPorBot(linhas.map((l) => ({ botId: l.botId, tags: l.tags })))
    for (const data of datas) {
      buscarResultadosDoDia(data, gruposBotTags).then((resultado) => {
        if (!ativo) return
        setResultadosPorDia((prev) => new Map(prev).set(data, resultado))
      })
    }
    return () => { ativo = false }
  }, [linhas, datas, erroIntervalo])

  const totais = useMemo(() => {
    if (!linhas) return { leads: 0, registros: 0, ftds: 0 }
    let leads = 0
    let registros = 0
    let ftds = 0
    for (const dia of resultadosPorDia.values()) {
      for (const linha of linhas) {
        const r = calcularResultadoLinhaNoDia(linha, dia)
        leads += r.leads
        registros += r.registros
        ftds += r.ftds
      }
    }
    return { leads, registros, ftds }
  }, [linhas, resultadosPorDia])

  const convFtdMedia = totais.leads > 0 ? (totais.ftds / totais.leads) * 100 : null
  const periodoLabel = inicio === fim ? inicio : `${inicio} até ${fim}`

  if (erro || erroIntervalo) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-[var(--error)] text-sm">{erro ?? erroIntervalo}</p>
      </div>
    )
  }

  if (carregandoConfig || !linhas) {
    return (
      <div className="h-full w-full flex items-center justify-center gap-2 text-[var(--text-muted)]">
        <Loader2 size={18} className="animate-spin" />
        Carregando...
      </div>
    )
  }

  return (
    <div className="min-h-full w-full px-4 py-8 md:px-10 md:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            Resultado — {linhas.length} funi{linhas.length === 1 ? 'l' : 's'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Período: {periodoLabel}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ResumoTile label="Leads" value={totais.leads} />
          <ResumoTile label="Registros" value={totais.registros} />
          <ResumoTile label="FTDs" value={totais.ftds} />
          <ResumoTile label="Conv. FTD" value={convFtdMedia === null ? 0 : convFtdMedia} suffix="%" decimals={1} />
        </div>

        <div className="space-y-4">
          {datas.map((data) => {
            const dia = resultadosPorDia.get(data)
            return <BlocoDia key={data} data={data} dia={dia} linhas={linhas} />
          })}
        </div>
      </div>
    </div>
  )
}

function ResumoTile({ label, value, suffix, decimals }: { label: string; value: number; suffix?: string; decimals?: number }) {
  return (
    <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-center flex flex-col items-center gap-1">
      <span className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
        {decimals ? value.toFixed(decimals) : formatInt(value)}
        {suffix ?? ''}
      </span>
      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
    </div>
  )
}

function BlocoDia({ data, dia, linhas }: { data: string; dia: ResultadoDia | undefined; linhas: LinhaConfig[] }) {
  const linhasComResultado = dia ? linhas.map((l) => ({ linha: l, r: calcularResultadoLinhaNoDia(l, dia) })) : []
  const totalDia = linhasComResultado.reduce(
    (acc, { r }) => ({ leads: acc.leads + r.leads, registros: acc.registros + r.registros, ftds: acc.ftds + r.ftds }),
    { leads: 0, registros: 0, ftds: 0 },
  )

  return (
    <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <h2 className="text-sm md:text-base font-semibold text-[var(--text-primary)]">{formatDataExtenso(data)}</h2>
        {dia ? (
          <span className="text-xs text-[var(--text-muted)]">
            {formatInt(totalDia.leads)} leads · {formatInt(totalDia.registros)} reg · {formatInt(totalDia.ftds)} FTDs
          </span>
        ) : (
          <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
        )}
      </div>
      {dia && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] uppercase text-[10px] tracking-wide">
                <th className="px-4 py-2 font-medium">Funil</th>
                <th className="px-4 py-2 font-medium text-right">Leads</th>
                <th className="px-4 py-2 font-medium text-right">Registros</th>
                <th className="px-4 py-2 font-medium text-right">FTDs</th>
                <th className="px-4 py-2 font-medium text-right">Conv. FTD %</th>
                <th className="px-4 py-2 font-medium text-right">Conv. Reg %</th>
              </tr>
            </thead>
            <tbody>
              {linhasComResultado.map(({ linha, r }) => (
                <tr key={linha.flowId} className="border-t border-[var(--glass-border)]">
                  <td className="px-4 py-2 text-[var(--text-primary)] font-medium">{linha.nomeFunil}</td>
                  <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatInt(r.leads)}</td>
                  <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatInt(r.registros)}</td>
                  <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatInt(r.ftds)}</td>
                  <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatPercent(r.convFtd)}</td>
                  <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatPercent(r.convReg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function FunisApresentarPage() {
  return (
    <Suspense>
      <FunisApresentarInner />
    </Suspense>
  )
}
