'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Trophy, ChevronDown, Download } from 'lucide-react'
import { agruparTagsPorBot } from '@/lib/sendpulseLeads'
import { buscarLeadsPorDiaLeadHub, type ProgressoLeadHub } from '@/lib/leadhubLeads'
import { gerarRangeDatas, buscarResultadosDoDia, calcularResultadoLinhaNoDia, tagDeEntradaDoFluxo, contarFunisPorCampanha, gastoDoFunil, type ResultadoDia } from '@/lib/funis'
import { GraficoLinha, type SerieLinha } from '@/components/ui/GraficoLinha'
import { GraficoBarraDupla } from '@/components/ui/GraficoBarraDupla'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import type { FlowTagConfig } from '@/types'
import type { CampanhaMeta } from '@/app/api/meta-ads/campanhas/route'

const MAX_DIAS_EXPORT_INTERVALO = 31
const PALETA_CORES = ['var(--d1)', 'var(--pontual)', 'var(--d3)', 'var(--d5)', 'var(--d7)', 'var(--success)']

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatPercent(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`
}

function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

function csvCampo(valor: string): string {
  if (valor.includes(',') || valor.includes('"') || valor.includes('\n')) {
    return `"${valor.replace(/"/g, '""')}"`
  }
  return valor
}

function baixarCsv(conteudo: string, nomeArquivo: string) {
  // BOM UTF-8 na frente: sem isso o Google Sheets/Excel às vezes erram a detecção de encoding
  // em CSVs com acentos.
  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
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
  const [leadsPorTagPorDia, setLeadsPorTagPorDia] = useState<Record<string, Record<string, number>>>({})
  const [leadHubConcluido, setLeadHubConcluido] = useState(false)
  const [leadHubProgresso, setLeadHubProgresso] = useState<ProgressoLeadHub | null>(null)
  const [campanhasMetaDoPeriodo, setCampanhasMetaDoPeriodo] = useState<CampanhaMeta[] | null>(null)

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

  // Uma chamada só pro período inteiro — cada campanha do Meta já vem com a data, então não
  // precisa buscar dia a dia como resultadosPorDia (que depende do LeadHub, sem esse endpoint).
  useEffect(() => {
    if (!inicio || !fim || erroIntervalo) return
    let ativo = true
    fetch(`/api/meta-ads/campanhas?from=${inicio}&to=${fim}`)
      .then((r) => r.json())
      .then((data) => {
        if (!ativo) return
        if (data.error) return
        setCampanhasMetaDoPeriodo(data.campanhas ?? [])
      })
    return () => { ativo = false }
  }, [inicio, fim, erroIntervalo])

  const tagsUnicas = useMemo(() => (linhas ? [...new Set(linhas.flatMap((l) => l.tags))] : []), [linhas])
  const leadHubCarregando = tagsUnicas.length > 0 && !leadHubConcluido

  useEffect(() => {
    if (!linhas || linhas.length === 0 || datas.length === 0 || erroIntervalo || tagsUnicas.length === 0) return
    let ativo = true
    buscarLeadsPorDiaLeadHub(tagsUnicas, inicio, fim, (p) => {
      if (ativo) setLeadHubProgresso(p)
    }).then((resultado) => {
      if (!ativo) return
      setLeadsPorTagPorDia(resultado)
      setLeadHubConcluido(true)
    })
    return () => { ativo = false }
  }, [linhas, datas, tagsUnicas, inicio, fim, erroIntervalo])

  const leadsDoFunilNoDia = useCallback(
    (linha: LinhaConfig, data: string) => {
      const tagEntrada = tagDeEntradaDoFluxo(linha.tags)
      return tagEntrada ? (leadsPorTagPorDia[tagEntrada]?.[data] ?? 0) : 0
    },
    [leadsPorTagPorDia],
  )

  const totais = useMemo(() => {
    if (!linhas) return { leads: 0, registros: 0, ftds: 0, gasto: 0 }
    let leads = 0
    let registros = 0
    let ftds = 0
    let gasto = 0
    for (const data of datas) {
      const dia = resultadosPorDia.get(data)
      if (!dia) continue
      for (const linha of linhas) {
        const r = calcularResultadoLinhaNoDia(linha, dia)
        leads += leadsDoFunilNoDia(linha, data)
        registros += r.registros
        ftds += r.ftds
      }
    }
    if (campanhasMetaDoPeriodo) {
      const funisPorCampanha = contarFunisPorCampanha(linhas)
      for (const linha of linhas) gasto += gastoDoFunil(linha.campanhasMeta, campanhasMetaDoPeriodo, funisPorCampanha)
    }
    return { leads, registros, ftds, gasto }
  }, [linhas, datas, resultadosPorDia, leadsDoFunilNoDia, campanhasMetaDoPeriodo])

  const convFtdMedia = totais.registros > 0 ? (totais.ftds / totais.registros) * 100 : null
  const temCampanhasConfiguradas = (linhas ?? []).some((l) => (l.campanhasMeta ?? []).length > 0)
  const periodoLabel = inicio === fim ? inicio : `${inicio} até ${fim}`

  const { list: casasList } = useCasasAposta()
  const casasDosFunis = useMemo(() => {
    if (!linhas) return []
    const idsUnicos = [...new Set(linhas.flatMap((l) => l.casas ?? []))]
    return idsUnicos
      .map((id) => casasList.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
  }, [linhas, casasList])

  const totaisPorFunil = useMemo(() => {
    if (!linhas) return []
    const funisPorCampanha = contarFunisPorCampanha(linhas)
    return linhas.map((linha) => {
      let leads = 0
      let registros = 0
      let ftds = 0
      for (const data of datas) {
        const dia = resultadosPorDia.get(data)
        if (!dia) continue
        const r = calcularResultadoLinhaNoDia(linha, dia)
        leads += leadsDoFunilNoDia(linha, data)
        registros += r.registros
        ftds += r.ftds
      }
      const convFtd = registros > 0 ? (ftds / registros) * 100 : null
      const convLeadReg = leads > 0 ? (registros / leads) * 100 : null
      const gasto = campanhasMetaDoPeriodo ? gastoDoFunil(linha.campanhasMeta, campanhasMetaDoPeriodo, funisPorCampanha) : 0
      const custoRegistro = registros > 0 && gasto > 0 ? gasto / registros : null
      const custoFtd = ftds > 0 && gasto > 0 ? gasto / ftds : null
      return { flowId: linha.flowId, nomeFunil: linha.nomeFunil, leads, registros, ftds, convFtd, convLeadReg, gasto, custoRegistro, custoFtd }
    })
  }, [linhas, datas, resultadosPorDia, leadsDoFunilNoDia, campanhasMetaDoPeriodo])

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

  // Uma linha só de conversão agregada não deixa ver qual funil está indo melhor — uma linha por
  // funil (mesma cor/legenda do resto da tela) deixa comparar a conversão de cada um dia a dia.
  const serieConversaoPorFunil = useMemo<SerieLinha[]>(() => {
    if (!linhas) return []
    const diasComDados = datas.filter((d) => resultadosPorDia.has(d))
    return linhas.map((linha, i) => ({
      nome: linha.nomeFunil,
      cor: PALETA_CORES[i % PALETA_CORES.length],
      pontos: diasComDados.map((data) => {
        const dia = resultadosPorDia.get(data)!
        const r = calcularResultadoLinhaNoDia(linha, dia)
        return { label: formatDataCurta(data), valor: r.registros > 0 ? (r.ftds / r.registros) * 100 : 0 }
      }),
    }))
  }, [linhas, datas, resultadosPorDia])

  const itensComparativo = totaisPorFunil.map((f) => ({ label: f.nomeFunil, valorA: f.registros, valorB: f.ftds }))

  const leadsPorFunilOrdenado = [...totaisPorFunil].sort((a, b) => b.leads - a.leads)

  const melhorConvFlowId = totaisPorFunil.reduce<{ flowId: string; convFtd: number } | null>((best, f) => {
    if (f.convFtd === null) return best
    if (!best || f.convFtd > best.convFtd) return { flowId: f.flowId, convFtd: f.convFtd }
    return best
  }, null)?.flowId ?? null

  const melhorFunilId = rankingPeriodo[0]?.flowId ?? null

  function exportarCsv() {
    if (!linhas) return
    const header = ['Data', 'Funil', 'Leads', 'Registros', 'FTDs', 'Conv. Lead → Reg %', 'Conv. FTD %']
    const linhasCsv: string[] = []
    for (const data of datas) {
      const dia = resultadosPorDia.get(data)
      if (!dia) continue
      let totalLeads = 0
      let totalRegistros = 0
      let totalFtds = 0
      for (const linha of linhas) {
        const r = calcularResultadoLinhaNoDia(linha, dia)
        const leads = leadsDoFunilNoDia(linha, data)
        const convFtd = r.registros > 0 ? ((r.ftds / r.registros) * 100).toFixed(1) : ''
        const convLeadReg = leads > 0 ? ((r.registros / leads) * 100).toFixed(1) : ''
        totalLeads += leads
        totalRegistros += r.registros
        totalFtds += r.ftds
        linhasCsv.push([data, linha.nomeFunil, String(leads), String(r.registros), String(r.ftds), convLeadReg, convFtd].map(csvCampo).join(','))
      }
      const totalConvFtd = totalRegistros > 0 ? ((totalFtds / totalRegistros) * 100).toFixed(1) : ''
      const totalConvLeadReg = totalLeads > 0 ? ((totalRegistros / totalLeads) * 100).toFixed(1) : ''
      linhasCsv.push([data, 'Total', String(totalLeads), String(totalRegistros), String(totalFtds), totalConvLeadReg, totalConvFtd].map(csvCampo).join(','))
    }
    const sufixo = inicio === fim ? inicio : `${inicio}_a_${fim}`
    baixarCsv([header.join(','), ...linhasCsv].join('\n'), `funis-apresentacao-${sufixo}.csv`)
  }

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
      <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6 lg:space-y-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
              Comparação de Funis — {linhas.length} funi{linhas.length === 1 ? 'l' : 's'}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Período: {periodoLabel}</p>
            {casasDosFunis.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {casasDosFunis.map((casa) => (
                  <span
                    key={casa.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-medium border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: casa.cor }} />
                    {casa.nome}
                  </span>
                ))}
              </div>
            )}
            {leadHubCarregando && (
              <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Carregando leads (LeadHub){leadHubProgresso ? ` — ${leadHubProgresso.concluidos}/${leadHubProgresso.total} tags` : '...'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={exportarCsv}
            disabled={resultadosPorDia.size === 0}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors shrink-0"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>

        <div className={`grid grid-cols-2 gap-3 ${temCampanhasConfiguradas ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          <ResumoTile label="Leads" value={totais.leads} loading={leadHubCarregando} />
          <ResumoTile label="Registros" value={totais.registros} />
          <ResumoTile label="FTDs" value={totais.ftds} />
          <ResumoTile label="Conv. FTD" value={convFtdMedia === null ? 0 : convFtdMedia} suffix="%" decimals={1} />
          {temCampanhasConfiguradas && (
            <ResumoTile label="Gasto (Meta)" value={totais.gasto} formatador={formatMoeda} loading={campanhasMetaDoPeriodo === null} />
          )}
        </div>

        {rankingPeriodo.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rankingPeriodo.map((r, i) => (
              <div
                key={r.flowId}
                className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6 flex items-center gap-3 lg:gap-4"
                style={{ borderLeft: `3px solid ${i === 0 ? '#F59E0B' : '#9CA3AF'}` }}
              >
                <Trophy size={20} className="lg:w-8 lg:h-8" style={{ color: i === 0 ? '#F59E0B' : '#9CA3AF' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] lg:text-xs text-[var(--text-muted)] uppercase tracking-wide">
                    {i === 0 ? 'Melhor funil do período' : '2º melhor funil do período'}
                  </div>
                  <div className="text-sm md:text-base lg:text-xl font-semibold text-[var(--text-primary)] truncate">{r.nomeFunil}</div>
                </div>
                <div className="text-right text-xs lg:text-sm text-[var(--text-secondary)] leading-relaxed">
                  <div>{formatInt(r.registros)} reg · {formatInt(r.ftds)} FTDs</div>
                  <div>{formatPercent(r.convFtd)} conv. FTD</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {serieConversaoPorFunil.length > 0 && serieConversaoPorFunil[0].pontos.length > 0 && (
          <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6">
            <h3 className="text-sm lg:text-lg font-semibold text-[var(--text-primary)] mb-3 lg:mb-4">Conversão de fluxo dos funis</h3>
            <GraficoLinha series={serieConversaoPorFunil} formatarValor={(v) => `${v.toFixed(1)}%`} altura={220} />
          </div>
        )}

        {!leadHubCarregando && leadsPorFunilOrdenado.length > 0 && (
          <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6">
            <h3 className="text-sm lg:text-lg font-semibold text-[var(--text-primary)]">Resultado geral</h3>
            <p className="text-xs lg:text-sm text-[var(--text-muted)] mb-3 lg:mb-4">
              Consolidado de {formatDataCurta(inicio)} até {formatDataCurta(fim)} ({datas.length} dia{datas.length === 1 ? '' : 's'})
            </p>
            <table className="w-full text-xs md:text-sm lg:text-base">
              <thead>
                <tr className="text-left text-[var(--text-muted)] uppercase text-[10px] lg:text-xs tracking-wide border-b border-[var(--border)]">
                  <th className="px-3 py-2 lg:py-3 font-medium">Funil</th>
                  <th className="px-3 py-2 lg:py-3 font-medium text-right">Leads</th>
                  <th className="px-3 py-2 lg:py-3 font-medium text-right">% Leads</th>
                  <th className="px-3 py-2 lg:py-3 font-medium text-right">Registros</th>
                  <th className="px-3 py-2 lg:py-3 font-medium text-right">FTDs</th>
                  <th className="px-3 py-2 lg:py-3 font-medium text-right">Conv. Lead → Reg %</th>
                  <th className="px-3 py-2 lg:py-3 font-medium text-right">Conv. Reg → FTD %</th>
                  {temCampanhasConfiguradas && (
                    <>
                      <th className="px-3 py-2 lg:py-3 font-medium text-right">Gasto (Meta)</th>
                      <th className="px-3 py-2 lg:py-3 font-medium text-right">Custo/Reg</th>
                      <th className="px-3 py-2 lg:py-3 font-medium text-right">Custo/FTD</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {leadsPorFunilOrdenado.map((f) => {
                  const melhor = f.flowId === melhorFunilId
                  return (
                    <tr
                      key={f.flowId}
                      className="border-t border-[var(--border)]"
                      style={melhor ? { backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)' } : undefined}
                    >
                      <td className="px-3 py-2 lg:py-3 text-[var(--text-primary)] font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {melhor && <Trophy size={12} style={{ color: 'var(--success)' }} />}
                          {f.nomeFunil}
                        </span>
                      </td>
                      <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">{formatInt(f.leads)}</td>
                      <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">
                        {totais.leads > 0 ? `${((f.leads / totais.leads) * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">{formatInt(f.registros)}</td>
                      <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">{formatInt(f.ftds)}</td>
                      <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">{formatPercent(f.convLeadReg)}</td>
                      <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">{formatPercent(f.convFtd)}</td>
                      {temCampanhasConfiguradas && (
                        <>
                          <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">{f.gasto > 0 ? formatMoeda(f.gasto) : '—'}</td>
                          <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">{f.custoRegistro === null ? '—' : formatMoeda(f.custoRegistro)}</td>
                          <td className="px-3 py-2 lg:py-3 text-right text-[var(--text-primary)]">{f.custoFtd === null ? '—' : formatMoeda(f.custoFtd)}</td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {itensComparativo.length > 0 && serieDiaria.registros.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6">
              <h3 className="text-sm lg:text-lg font-semibold text-[var(--text-primary)] mb-3 lg:mb-4">Registros vs FTDs por funil</h3>
              <GraficoBarraDupla itens={itensComparativo} nomeA="Registros" nomeB="FTDs" formatarValor={formatInt} />
            </div>
            <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6">
              <h3 className="text-sm lg:text-lg font-semibold text-[var(--text-primary)] mb-3 lg:mb-4">Conversão Registro → FTD por funil</h3>
              <table className="w-full text-xs md:text-sm lg:text-base">
                <thead>
                  <tr className="text-left text-[var(--text-muted)] uppercase text-[10px] lg:text-xs tracking-wide border-b border-[var(--border)]">
                    <th className="px-3 py-2 lg:py-3 font-medium">Funil</th>
                    <th className="px-3 py-2 lg:py-3 font-medium text-right">Conv. FTD %</th>
                  </tr>
                </thead>
                <tbody>
                  {totaisPorFunil.map((f) => {
                    const melhor = f.flowId === melhorConvFlowId
                    return (
                      <tr
                        key={f.flowId}
                        className="border-t border-[var(--border)]"
                        style={melhor ? { backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)' } : undefined}
                      >
                        <td className="px-3 py-2 lg:py-3 text-[var(--text-primary)] font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {melhor && <Trophy size={12} style={{ color: 'var(--success)' }} />}
                            {f.nomeFunil}
                          </span>
                        </td>
                        <td
                          className="px-3 py-2 lg:py-3 text-right font-semibold"
                          style={{ color: melhor ? 'var(--success)' : 'var(--text-primary)' }}
                        >
                          {formatPercent(f.convFtd)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {datas.map((data) => {
            const dia = resultadosPorDia.get(data)
            return (
              <BlocoDia
                key={data}
                data={data}
                dia={dia}
                linhas={linhas}
                leadsPorTagPorDia={leadsPorTagPorDia}
                leadHubCarregando={leadHubCarregando}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ResumoTile({ label, value, suffix, decimals, loading, formatador }: { label: string; value: number; suffix?: string; decimals?: number; loading?: boolean; formatador?: (v: number) => string }) {
  return (
    <div className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 lg:p-6 text-center flex flex-col items-center gap-1 lg:gap-2">
      {loading ? (
        <Loader2 size={20} className="lg:w-7 lg:h-7 animate-spin text-[var(--text-muted)] my-1" />
      ) : (
        <span className="text-xl md:text-2xl lg:text-4xl font-bold text-[var(--text-primary)]">
          {formatador ? formatador(value) : decimals ? value.toFixed(decimals) : formatInt(value)}
          {suffix ?? ''}
        </span>
      )}
      <span className="text-xs lg:text-sm text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
    </div>
  )
}

function BlocoDia({
  data,
  dia,
  linhas,
  leadsPorTagPorDia,
  leadHubCarregando,
}: {
  data: string
  dia: ResultadoDia | undefined
  linhas: LinhaConfig[]
  leadsPorTagPorDia: Record<string, Record<string, number>>
  leadHubCarregando: boolean
}) {
  const [aberto, setAberto] = useState(true)
  const linhasComResultado = dia
    ? linhas.map((l) => {
        const r = calcularResultadoLinhaNoDia(l, dia)
        const convFtd = r.registros > 0 ? (r.ftds / r.registros) * 100 : null
        const tagEntradaDia = tagDeEntradaDoFluxo(l.tags)
        const leads = tagEntradaDia ? (leadsPorTagPorDia[tagEntradaDia]?.[data] ?? 0) : 0
        const convLeadReg = leads > 0 ? (r.registros / leads) * 100 : null
        return { linha: l, leads, registros: r.registros, ftds: r.ftds, convFtd, convLeadReg }
      })
    : []
  const totalDia = linhasComResultado.reduce(
    (acc, { leads, registros, ftds }) => ({ leads: acc.leads + leads, registros: acc.registros + registros, ftds: acc.ftds + ftds }),
    { leads: 0, registros: 0, ftds: 0 },
  )
  const totalConvFtd = totalDia.registros > 0 ? (totalDia.ftds / totalDia.registros) * 100 : null
  const totalConvLeadReg = totalDia.leads > 0 ? (totalDia.registros / totalDia.leads) * 100 : null

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
            {leadHubCarregando ? '…' : formatInt(totalDia.leads)} leads · {formatInt(totalDia.registros)} reg · {formatInt(totalDia.ftds)} FTDs
          </span>
        ) : (
          <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
        )}
      </button>
      {dia && aberto && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] uppercase text-[10px] tracking-wide border-b border-[var(--border)]">
                <th className="px-4 py-2 font-medium">Funil</th>
                <th className="px-4 py-2 font-medium text-right">Leads</th>
                <th className="px-4 py-2 font-medium text-right">Registros</th>
                <th className="px-4 py-2 font-medium text-right">FTDs</th>
                <th className="px-4 py-2 font-medium text-right">Conv. Lead → Reg %</th>
                <th className="px-4 py-2 font-medium text-right">Conv. FTD %</th>
              </tr>
            </thead>
            <tbody>
              {linhasComResultado.map(({ linha, leads, registros, ftds, convFtd, convLeadReg }) => {
                const melhor = linha.flowId === melhorFlowId
                return (
                  <tr
                    key={linha.flowId}
                    className="border-t border-[var(--border)]"
                    style={melhor ? { backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)' } : undefined}
                  >
                    <td className="px-4 py-2 text-[var(--text-primary)] font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {melhor && <Trophy size={12} style={{ color: 'var(--success)' }} />}
                        {linha.nomeFunil}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--text-primary)]">
                      {leadHubCarregando ? <Loader2 size={12} className="animate-spin inline-block" /> : formatInt(leads)}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--text-primary)]">{formatInt(registros)}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-primary)]">{formatInt(ftds)}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-primary)]">
                      {leadHubCarregando ? <Loader2 size={12} className="animate-spin inline-block" /> : formatPercent(convLeadReg)}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--text-primary)]">{formatPercent(convFtd)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border)] font-semibold">
                <td className="px-4 py-2 text-[var(--text-primary)]">Total</td>
                <td className="px-4 py-2 text-right text-[var(--text-primary)]">
                  {leadHubCarregando ? <Loader2 size={12} className="animate-spin inline-block" /> : formatInt(totalDia.leads)}
                </td>
                <td className="px-4 py-2 text-right text-[var(--text-primary)]">{formatInt(totalDia.registros)}</td>
                <td className="px-4 py-2 text-right text-[var(--text-primary)]">{formatInt(totalDia.ftds)}</td>
                <td className="px-4 py-2 text-right text-[var(--text-primary)]">
                  {leadHubCarregando ? <Loader2 size={12} className="animate-spin inline-block" /> : formatPercent(totalConvLeadReg)}
                </td>
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
