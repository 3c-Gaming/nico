'use client'

import { useState, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Upload, FileText, Download, Search, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { BarraComparativa } from '@/components/resultados-junho/BarraComparativa'
import { GraficoLinha } from '@/components/ui/GraficoLinha'
import { Dropdown } from '@/components/ui/Dropdown'
import { useUtmConfigs } from '@/hooks/useUtmConfigs'
import { analisarBaseCsv, gerarCsvDestinatarios } from '@/lib/analiseBaseDaxx'
import type { AnaliseBaseDaxx, DestinatarioBase } from '@/types'

const POR_PAGINA = 50

const STATUS_FILTROS = ['Todos', 'Lido', 'Entregue', 'Falha', 'Pendente'] as const
type StatusFiltro = (typeof STATUS_FILTROS)[number]

const STATUS_COR: Record<string, string> = {
  Lido: 'var(--success)',
  Entregue: 'var(--info)',
  Falha: 'var(--error)',
  Pendente: 'var(--warning)',
}

function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatSegundos(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}min`
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`
  return `${(s / 86400).toFixed(1)}d`
}

function StatBox({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
      <div className="text-xl font-bold font-mono" style={{ color: cor }}>{valor}</div>
      <div className="text-[10px] text-[var(--text-muted)] mt-1">{label}</div>
    </div>
  )
}

function baixarCsv(conteudo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

function TabelaDestinatarios({ destinatarios }: { destinatarios: DestinatarioBase[] }) {
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>('Todos')
  const [somenteOptOut, setSomenteOptOut] = useState(false)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)

  const filtrados = useMemo(() => {
    return destinatarios.filter((d) => {
      if (filtroStatus !== 'Todos' && d.status !== filtroStatus) return false
      if (somenteOptOut && !d.optOut) return false
      if (busca.trim() && !d.numero.includes(busca.trim())) return false
      return true
    })
  }, [destinatarios, filtroStatus, somenteOptOut, busca])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtrados.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)

  function handleFiltroStatus(s: StatusFiltro) {
    setFiltroStatus(s)
    setPagina(0)
  }

  function handleExportar() {
    const nomeStatus = filtroStatus === 'Todos' ? 'todos' : filtroStatus.toLowerCase()
    const csv = gerarCsvDestinatarios(filtrados)
    baixarCsv(csv, `destinatarios_${nomeStatus}${somenteOptOut ? '_optout' : ''}.csv`)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Destinatários ({formatNumero(filtrados.length)})</h2>
        <button
          onClick={handleExportar}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <Download size={13} />
          Exportar CSV
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        {STATUS_FILTROS.map((s) => (
          <button
            key={s}
            onClick={() => handleFiltroStatus(s)}
            className="px-2.5 py-1 rounded text-xs font-medium border transition-colors"
            style={
              filtroStatus === s
                ? { backgroundColor: `${STATUS_COR[s] ?? 'var(--text-primary)'}20`, borderColor: `${STATUS_COR[s] ?? 'var(--text-primary)'}40`, color: STATUS_COR[s] ?? 'var(--text-primary)' }
                : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
            }
          >
            {s}
          </button>
        ))}
        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={somenteOptOut} onChange={(e) => { setSomenteOptOut(e.target.checked); setPagina(0) }} />
          Só opt-out
        </label>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0) }}
            placeholder="Buscar número..."
            className="pl-7 pr-2.5 py-1 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--d1)]"
          />
        </div>
      </div>

      <div className="rounded-md border border-[var(--border)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
              <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Número</th>
              <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Status</th>
              <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Entregue em</th>
              <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Lido em</th>
              <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Erro</th>
              <th className="text-center py-2 px-3 font-medium text-[var(--text-muted)]">Opt-out</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-[var(--text-muted)]">Nenhum destinatário encontrado.</td>
              </tr>
            )}
            {visiveis.map((d) => (
              <tr key={d.numero} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elevated)]/50">
                <td className="py-1.5 px-3 font-mono text-[var(--text-primary)]">{d.numero}</td>
                <td className="py-1.5 px-3 font-medium" style={{ color: STATUS_COR[d.status] ?? 'var(--text-muted)' }}>{d.status}</td>
                <td className="py-1.5 px-3 text-[var(--text-secondary)]">{d.entregueEm ?? '—'}</td>
                <td className="py-1.5 px-3 text-[var(--text-secondary)]">{d.lidoEm ?? '—'}</td>
                <td className="py-1.5 px-3 text-[var(--text-muted)]">{d.erroDescricao ?? '—'}</td>
                <td className="py-1.5 px-3 text-center">{d.optOut ? 'Sim' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={paginaAtual === 0}
            className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            Página {paginaAtual + 1} de {totalPaginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={paginaAtual >= totalPaginas - 1}
            className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  )
}

interface ResultadoFinanceiro {
  registros: number
  ftds: number
  cpas: number
}

function ResultadoFinanceiroSection({ dataDisparoInicial }: { dataDisparoInicial: string | null }) {
  const { list: utmConfigs } = useUtmConfigs()
  const [utmId, setUtmId] = useState<string | null>(null)
  const [data, setData] = useState(dataDisparoInicial ?? '')
  const [resultado, setResultado] = useState<ResultadoFinanceiro | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const utmSelecionado = utmConfigs.find((u) => u.id === utmId) ?? null

  async function buscar() {
    if (!utmSelecionado || !data) return
    setCarregando(true)
    setErro(null)
    setResultado(null)
    try {
      const res = await fetch(
        `/api/campanhas/relatorio/utm?utm=${encodeURIComponent(utmSelecionado.valor)}&casa=${encodeURIComponent(utmSelecionado.casa)}&date=${encodeURIComponent(data)}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar dados')
      setResultado({ registros: json.registros ?? 0, ftds: json.ftds ?? 0, cpas: json.cpas ?? 0 })
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <DollarSign size={16} className="text-[var(--success)]" />
        Resultado Financeiro
      </h2>

      <div className="flex items-end gap-3 flex-wrap mb-4">
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1">UTM / PID</label>
          <Dropdown label={utmSelecionado ? utmSelecionado.nome : 'Selecionar...'}>
            <div className="p-1 min-w-[220px] max-h-[280px] overflow-y-auto">
              {utmConfigs.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-[var(--text-muted)]">Nenhum UTM/PID cadastrado em /utms</p>
              )}
              {utmConfigs.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUtmId(u.id)}
                  className="flex items-center justify-between gap-2 w-full px-2 py-1.5 text-sm rounded text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <span>{u.nome}</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{u.casa === 'superbet' ? 'SB' : 'MGM'}</span>
                </button>
              ))}
            </div>
          </Dropdown>
        </div>
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1">Data do disparo</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-8 px-2.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus:border-[var(--d1)]"
          />
        </div>
        <button
          onClick={buscar}
          disabled={!utmSelecionado || !data || carregando}
          className="h-8 px-3 rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: 'var(--d1)' }}
        >
          {carregando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {erro && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-4" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
          <AlertTriangle size={14} />
          {erro}
        </div>
      )}

      {resultado && (
        <div className="grid grid-cols-3 gap-3 max-w-md">
          <StatBox label="Registros" valor={formatNumero(resultado.registros)} cor="var(--info)" />
          <StatBox label="FTDs" valor={formatNumero(resultado.ftds)} cor="var(--success)" />
          <StatBox label="CPAs" valor={formatNumero(resultado.cpas)} cor="var(--warning)" />
        </div>
      )}
    </section>
  )
}

function AnaliseBaseInner() {
  const searchParams = useSearchParams()
  const nome = searchParams.get('nome') ?? ''
  const inputRef = useRef<HTMLInputElement>(null)

  const [analise, setAnalise] = useState<AnaliseBaseDaxx | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)

  function processarArquivo(file: File) {
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const texto = reader.result as string
        const resultado = analisarBaseCsv(texto)
        if (resultado.total === 0) {
          setError('Não encontrei linhas reconhecíveis nesse CSV. Confira se é o relatório de entrega exportado da DAXX (colunas: Número, Enviado em, Status, Entregue em, Lido em, Erro código, Erro descrição, Opt-out).')
          return
        }
        setAnalise(resultado)
        setNomeArquivo(file.name)
      } catch {
        setError('Erro ao processar o CSV. Confira se o arquivo é o relatório de entrega da DAXX.')
      }
    }
    reader.onerror = () => setError('Erro ao ler o arquivo.')
    reader.readAsText(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processarArquivo(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processarArquivo(file)
  }

  return (
    <>
      <PageHeader
        titulo="Análise de Base"
        descricao={nome || 'Relatório de entrega por destinatário'}
        acoes={
          <Link
            href="/daxx"
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar
          </Link>
        }
      />

      <div className="p-6 space-y-8">
        {!analise && (
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 py-24 rounded-md border-2 border-dashed cursor-pointer transition-colors"
            style={{
              borderColor: arrastando ? 'var(--d1)' : 'var(--border)',
              backgroundColor: arrastando ? 'var(--d1)10' : 'var(--bg-surface)',
            }}
          >
            <Upload size={28} className="text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-primary)]">Arraste o CSV da base disparada aqui, ou clique pra escolher</p>
            <p className="text-xs text-[var(--text-muted)]">Baixe o relatório de entrega direto na listagem de disparos da DAXX (botão &ldquo;⬇ CSV&rdquo;)</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {analise && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <FileText size={14} />
                {nomeArquivo}
              </div>
              <button
                onClick={() => { setAnalise(null); setNomeArquivo(null); setError(null) }}
                className="text-xs text-[var(--d1)] hover:underline"
              >
                Trocar arquivo
              </button>
            </div>

            <section>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="Total" valor={formatNumero(analise.total)} cor="var(--text-primary)" />
                <StatBox label="Taxa de Entrega" valor={`${analise.taxaEntregaTotal}%`} cor="var(--info)" />
                <StatBox label="Taxa de Leitura" valor={`${analise.pctLidos}%`} cor="var(--success)" />
                <StatBox label="Leitura/Entregues" valor={`${analise.taxaLeituraSobreEntregues}%`} cor="var(--d1)" />
                <StatBox label="Taxa de Falha" valor={`${analise.pctFalhas}%`} cor="var(--error)" />
                <StatBox label="Pendentes" valor={`${analise.pctPendentes}%`} cor="var(--warning)" />
                <StatBox label="Opt-out" valor={`${analise.pctOptOuts}%`} cor="var(--pontual)" />
              </div>
            </section>

            <ResultadoFinanceiroSection key={nomeArquivo} dataDisparoInicial={analise.dataDisparo} />

            <section>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Funil de entrega</h2>
              <BarraComparativa
                itens={[
                  { label: 'Enviado', valor: analise.total, cor: 'var(--info)' },
                  { label: 'Entregue', valor: analise.entregues + analise.lidos, cor: 'var(--success)' },
                  { label: 'Lido', valor: analise.lidos, cor: 'var(--d1)' },
                ]}
                formatarValor={formatNumero}
                alturaBarra={18}
              />
            </section>

            <section className="">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Velocidade de leitura</h2>
              <div className="grid grid-cols-2 gap-2">
                <GraficoLinha
                pontos={analise.faixasLeitura.map((f) => ({ label: f.label, valor: f.total }))}
                cor="var(--d1)"
                formatarValor={formatNumero}
              />
              <div className="grid grid-cols-4 gap-3 mt-4">
                <StatBox label="Média" valor={formatSegundos(analise.tempoLeituraMedioSeg)} cor="var(--d1)" />
                <StatBox label="Mediana" valor={formatSegundos(analise.tempoLeituraMedianaSeg)} cor="var(--d1)" />
                {analise.faixasLeitura.map((f) => (
                  <StatBox key={f.label} label={f.label} valor={formatNumero(f.total)} cor="var(--text-primary)" />
                ))}
              </div>
              </div>
            </section>

            {analise.distribuicaoDdd.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">DDD por volume</h2>
                  <BarraComparativa
                    itens={analise.distribuicaoDdd.map((d) => ({ label: `${d.ddd} (${d.uf})`, valor: d.total, cor: 'var(--d3)', destaque: `${formatNumero(d.total)} · ${d.pctLeitura}% lido` }))}
                    formatarValor={formatNumero}
                    alturaBarra={18}
                  />
                </section>
                {analise.distribuicaoDddPorLeitura.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                      DDD por engajamento
                      <span className="text-xs font-normal text-[var(--text-muted)] ml-2">mín. 5 envios</span>
                    </h2>
                    <BarraComparativa
                      itens={analise.distribuicaoDddPorLeitura.map((d) => ({ label: `${d.ddd} (${d.uf})`, valor: d.pctLeitura, cor: 'var(--success)', destaque: `${d.pctLeitura}% · ${formatNumero(d.total)} env.` }))}
                      alturaBarra={18}
                    />
                  </section>
                )}
              </div>
            )}

            <TabelaDestinatarios destinatarios={analise.destinatarios} />
          </>
        )}
      </div>
    </>
  )
}

export default function AnaliseBasePage() {
  return (
    <Suspense>
      <AnaliseBaseInner />
    </Suspense>
  )
}
