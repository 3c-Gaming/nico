'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Trophy, ChevronDown } from 'lucide-react'
import { agruparTagsPorBot } from '@/lib/sendpulseLeads'
import { gerarRangeDatas, buscarResultadosDoDia, calcularResultadoLinhaNoDia, type ResultadoDia } from '@/lib/funis'
import { GraficoLinha } from '@/components/ui/GraficoLinha'
import { GraficoBarraDupla } from '@/components/ui/GraficoBarraDupla'
import { BarraComparativa } from '@/components/resultados-junho/BarraComparativa'
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

function formatDataCurta(data: string): string {
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}

interface LinhaConfig extends FlowTagConfig {
  nomeFunil: string
}

interface MetricasFunil {
  flowId: string
  registros: number
  ftds: number
  convFtd: number | null // % de registros que viraram FTD — não depende de leads
}

// "Melhor funil" não é uma métrica só — o usuário quer o que mais tem registro, mais FTD e melhor
// conversão de registro pra FTD juntos. Score = soma de cada métrica normalizada pelo melhor valor
// do grupo (0 a 1 cada, 3 no total) — não depende de leads (dado hoje não confiável).
function rankearFunis<T extends MetricasFunil>(itens: T[]): (T & { score: number })[] {
  const maxRegistros = Math.max(0, ...itens.map((i) => i.registros))
  const maxFtds = Math.max(0, ...itens.map((i) => i.ftds))
  const maxConvFtd = Math.max(0, ...itens.map((i) => i.convFtd ?? 0))
  return itens
    .map((item) => ({
      ...item,
      score:
        (maxRegistros > 0 ? item.registros / maxRegistros : 0) +
        (maxFtds > 0 ? item.ftds / maxFtds : 0) +
        (maxConvFtd > 0 ? (item.convFtd ?? 0) / maxConvFtd : 0),
    }))
    .sort((a, b) => b.score - a.score)
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
    if (!linhas) return { registros: 0, ftds: 0 }
    let registros = 0
    let ftds = 0
    for (const dia of resultadosPorDia.values()) {
      for (const linha of linhas) {
        const r = calcularResultadoLinhaNoDia(linha, dia)
        registros += r.registros
        ftds += r.ftds
      }
    }
    return { registros, ftds }
  }, [linhas, resultadosPorDia])

  const convFtdMedia = totais.registros > 0 ? (totais.ftds / totais.registros) * 100 : null
  const periodoLabel = inicio === fim ? inicio : `${inicio} até ${fim}`

  const totaisPorFunil = useMemo(() => {
    if (!linhas) return []
    return linhas.map((linha) => {
      let registros = 0
      let ftds = 0
      for (const dia of resultadosPorDia.values()) {
        const r = calcularResultadoLinhaNoDia(linha, dia)
        registros += r.registros
        ftds += r.ftds
      }
      const convFtd = registros > 0 ? (ftds / registros) * 100 : null
      return { flowId: linha.flowId, nomeFunil: linha.nomeFunil, registros, ftds, convFtd }
    })
  }, [linhas, resultadosPorDia])

  const rankingPeriodo = useMemo(
    () => rankearFunis(totaisPorFunil).filter((r) => r.score > 0).slice(0, 2),
    [totaisPorFunil],
  )

  const serieDiaria = useMemo(() => {
    if (!linhas) return { registros: [], ftds: [] }
    const registros: { label: string; valor: number }[] = []
    const ftds: { label: string; valor: number }[] = []
    for (const data of datas) {
      const dia = resultadosPorDia.get(data)
      if (!dia) continue
      let r = 0
      let f = 0
      for (const linha of linhas) {
        const res = calcularResultadoLinhaNoDia(linha, dia)
        r += res.registros
        f += res.ftds
      }
      const label = formatDataCurta(data)
      registros.push({ label, valor: r })
      ftds.push({ label, valor: f })
    }
    return { registros, ftds }
  }, [linhas, datas, resultadosPorDia])

  const itensComparativo = totaisPorFunil.map((f) => ({ label: f.nomeFunil, valorA: f.registros, valorB: f.ftds }))

  const itensRankingConversao = [...totaisPorFunil]
    .sort((a, b) => (b.convFtd ?? 0) - (a.convFtd ?? 0))
    .map((f) => ({ label: f.nomeFunil, valor: f.convFtd ?? 0, cor: 'var(--success)' }))

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

        <div className="grid grid-cols-3 gap-3">
          <ResumoTile label="Registros" value={totais.registros} />
          <ResumoTile label="FTDs" value={totais.ftds} />
          <ResumoTile label="Conv. FTD" value={convFtdMedia === null ? 0 : convFtdMedia} suffix="%" decimals={1} />
        </div>

        {rankingPeriodo.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rankingPeriodo.map((r, i) => (
              <div
                key={r.flowId}
                className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 flex items-center gap-3"
                style={{ borderLeft: `3px solid ${i === 0 ? '#F59E0B' : '#9CA3AF'}` }}
              >
                <Trophy size={20} style={{ color: i === 0 ? '#F59E0B' : '#9CA3AF' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
                    {i === 0 ? 'Melhor funil do período' : '2º melhor funil do período'}
                  </div>
                  <div className="text-sm md:text-base font-semibold text-[var(--text-primary)] truncate">{r.nomeFunil}</div>
                </div>
                <div className="text-right text-xs text-[var(--text-secondary)] leading-relaxed">
                  <div>{formatInt(r.registros)} reg · {formatInt(r.ftds)} FTDs</div>
                  <div>{formatPercent(r.convFtd)} conv. FTD</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {serieDiaria.registros.length > 0 && (
          <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Evolução no período</h3>
            <GraficoLinha
              series={[
                { nome: 'Registros', cor: 'var(--d1)', pontos: serieDiaria.registros },
                { nome: 'FTDs', cor: 'var(--pontual)', pontos: serieDiaria.ftds },
              ]}
              formatarValor={formatInt}
            />
          </div>
        )}

        {itensComparativo.length > 0 && serieDiaria.registros.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Registros vs FTDs por funil</h3>
              <GraficoBarraDupla itens={itensComparativo} nomeA="Registros" nomeB="FTDs" formatarValor={formatInt} />
            </div>
            <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Ranking de conversão (FTD %)</h3>
              <BarraComparativa itens={itensRankingConversao} formatarValor={(v) => `${v.toFixed(1)}%`} />
            </div>
          </div>
        )}

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
  const [aberto, setAberto] = useState(true)
  const linhasComResultado = dia
    ? linhas.map((l) => {
        const r = calcularResultadoLinhaNoDia(l, dia)
        const convFtd = r.registros > 0 ? (r.ftds / r.registros) * 100 : null
        return { linha: l, registros: r.registros, ftds: r.ftds, convFtd }
      })
    : []
  const totalDia = linhasComResultado.reduce(
    (acc, { registros, ftds }) => ({ registros: acc.registros + registros, ftds: acc.ftds + ftds }),
    { registros: 0, ftds: 0 },
  )
  const totalConvFtd = totalDia.registros > 0 ? (totalDia.ftds / totalDia.registros) * 100 : null

  const rankingDia = rankearFunis(
    linhasComResultado.map(({ linha, registros, ftds, convFtd }) => ({ flowId: linha.flowId, registros, ftds, convFtd })),
  )
  const melhorFlowId = rankingDia.length > 0 && rankingDia[0].score > 0 ? rankingDia[0].flowId : null

  return (
    <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 border-b border-[var(--glass-border)] text-left hover:bg-[var(--glass-hover-bg)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${aberto ? '' : '-rotate-90'}`} />
          <h2 className="text-sm md:text-base font-semibold text-[var(--text-primary)]">{formatDataExtenso(data)}</h2>
        </span>
        {dia ? (
          <span className="text-xs text-[var(--text-muted)]">
            {formatInt(totalDia.registros)} reg · {formatInt(totalDia.ftds)} FTDs
          </span>
        ) : (
          <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
        )}
      </button>
      {dia && aberto && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] uppercase text-[10px] tracking-wide">
                <th className="px-4 py-2 font-medium">Funil</th>
                <th className="px-4 py-2 font-medium text-right">Registros</th>
                <th className="px-4 py-2 font-medium text-right">FTDs</th>
                <th className="px-4 py-2 font-medium text-right">Conv. FTD %</th>
              </tr>
            </thead>
            <tbody>
              {linhasComResultado.map(({ linha, registros, ftds, convFtd }) => {
                const melhor = linha.flowId === melhorFlowId
                return (
                  <tr
                    key={linha.flowId}
                    className="border-t border-[var(--glass-border)]"
                    style={melhor ? { backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)' } : undefined}
                  >
                    <td className="px-4 py-2 text-[var(--text-primary)] font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {melhor && <Trophy size={12} style={{ color: 'var(--success)' }} />}
                        {linha.nomeFunil}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatInt(registros)}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatInt(ftds)}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatPercent(convFtd)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--glass-border)] font-semibold">
                <td className="px-4 py-2 text-[var(--text-primary)]">Total</td>
                <td className="px-4 py-2 text-right text-[var(--text-primary)]">{formatInt(totalDia.registros)}</td>
                <td className="px-4 py-2 text-right text-[var(--text-primary)]">{formatInt(totalDia.ftds)}</td>
                <td className="px-4 py-2 text-right text-[var(--text-primary)]">{formatPercent(totalConvFtd)}</td>
              </tr>
            </tfoot>
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
