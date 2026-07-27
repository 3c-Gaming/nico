'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { GraficoBarraDupla } from '@/components/ui/GraficoBarraDupla'
import { GraficoLinha } from '@/components/ui/GraficoLinha'
import { analisarBaseCsv } from '@/lib/analiseBaseDaxx'
import type { AnaliseBaseDaxx } from '@/types'

const COR_A = 'var(--d1)'
const COR_B = 'var(--pontual)'

function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatSegundos(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}min`
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`
  return `${(s / 86400).toFixed(1)}d`
}

interface MetricaKpi {
  label: string
  valorA: number
  valorB: number
  melhorMaior: boolean
  formatar: (v: number) => string
}

function LinhaKpi({ metrica }: { metrica: MetricaKpi }) {
  const { label, valorA, valorB, melhorMaior, formatar } = metrica
  const diff = valorA - valorB
  const aGanha = diff !== 0 && (melhorMaior ? diff > 0 : diff < 0)
  const bGanha = diff !== 0 && (melhorMaior ? diff < 0 : diff > 0)

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <div className={`text-right font-mono font-semibold text-lg ${aGanha ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'}`}>
        {formatar(valorA)}
      </div>
      <div className="text-[10px] text-[var(--text-muted)] text-center px-2 whitespace-nowrap min-w-[110px]">{label}</div>
      <div className={`text-left font-mono font-semibold text-lg ${bGanha ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'}`}>
        {formatar(valorB)}
      </div>
    </div>
  )
}

function AreaUpload({ titulo, cor, nomeArquivo, onFile, onLimpar }: {
  titulo: string
  cor: string
  nomeArquivo: string | null
  onFile: (file: File) => void
  onLimpar: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{titulo}</h3>
      </div>

      {nomeArquivo ? (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] truncate">
            <FileText size={14} className="shrink-0" />
            <span className="truncate">{nomeArquivo}</span>
          </div>
          <button onClick={onLimpar} className="text-xs text-[var(--d1)] hover:underline shrink-0 ml-2">
            Trocar
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 py-10 rounded-md border-2 border-dashed cursor-pointer transition-colors"
          style={{
            borderColor: arrastando ? cor : 'var(--border)',
            backgroundColor: arrastando ? `${cor}10` : 'var(--bg-surface)',
          }}
        >
          <Upload size={22} className="text-[var(--text-muted)]" />
          <p className="text-xs text-[var(--text-primary)] text-center px-4">Arraste o CSV ou clique pra escolher</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
          />
        </div>
      )}
    </div>
  )
}

export default function CompararBasesPage() {
  const [analiseA, setAnaliseA] = useState<AnaliseBaseDaxx | null>(null)
  const [analiseB, setAnaliseB] = useState<AnaliseBaseDaxx | null>(null)
  const [nomeA, setNomeA] = useState<string | null>(null)
  const [nomeB, setNomeB] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function processarArquivo(file: File, lado: 'A' | 'B') {
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const resultado = analisarBaseCsv(reader.result as string)
        if (resultado.total === 0) {
          setError(`O arquivo de Base ${lado} não parece ser um relatório de entrega da DAXX.`)
          return
        }
        if (lado === 'A') { setAnaliseA(resultado); setNomeA(file.name) }
        else { setAnaliseB(resultado); setNomeB(file.name) }
      } catch {
        setError(`Erro ao processar o CSV da Base ${lado}.`)
      }
    }
    reader.onerror = () => setError(`Erro ao ler o arquivo da Base ${lado}.`)
    reader.readAsText(file)
  }

  const ambasCarregadas = analiseA && analiseB

  const metricas: MetricaKpi[] = ambasCarregadas ? [
    { label: 'Total', valorA: analiseA.total, valorB: analiseB.total, melhorMaior: true, formatar: formatNumero },
    { label: 'Taxa de Entrega', valorA: analiseA.taxaEntregaTotal, valorB: analiseB.taxaEntregaTotal, melhorMaior: true, formatar: (v) => `${v}%` },
    { label: 'Taxa de Leitura', valorA: analiseA.pctLidos, valorB: analiseB.pctLidos, melhorMaior: true, formatar: (v) => `${v}%` },
    { label: 'Leitura/Entregues', valorA: analiseA.taxaLeituraSobreEntregues, valorB: analiseB.taxaLeituraSobreEntregues, melhorMaior: true, formatar: (v) => `${v}%` },
    { label: 'Taxa de Falha', valorA: analiseA.pctFalhas, valorB: analiseB.pctFalhas, melhorMaior: false, formatar: (v) => `${v}%` },
    { label: 'Opt-out', valorA: analiseA.pctOptOuts, valorB: analiseB.pctOptOuts, melhorMaior: false, formatar: (v) => `${v}%` },
    { label: 'Mediana Leitura', valorA: analiseA.tempoLeituraMedianaSeg, valorB: analiseB.tempoLeituraMedianaSeg, melhorMaior: false, formatar: formatSegundos },
  ] : []

  return (
    <>
      <PageHeader
        titulo="Comparar Bases"
        descricao="Compare duas bases disparadas lado a lado"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AreaUpload
            titulo="Base A"
            cor={COR_A}
            nomeArquivo={nomeA}
            onFile={(f) => processarArquivo(f, 'A')}
            onLimpar={() => { setAnaliseA(null); setNomeA(null) }}
          />
          <AreaUpload
            titulo="Base B"
            cor={COR_B}
            nomeArquivo={nomeB}
            onFile={(f) => processarArquivo(f, 'B')}
            onLimpar={() => { setAnaliseB(null); setNomeB(null) }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {!ambasCarregadas && (
          <p className="text-xs text-[var(--text-muted)] text-center py-8">Carregue as duas bases pra ver a comparação.</p>
        )}

        {ambasCarregadas && (
          <>
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">KPIs</h2>
              </div>
              <div className="flex items-center justify-center gap-8 text-xs text-[var(--text-muted)] mb-1">
                <span className="truncate max-w-[200px]" style={{ color: COR_A }}>{nomeA}</span>
                <span className="truncate max-w-[200px]" style={{ color: COR_B }}>{nomeB}</span>
              </div>
              <div className="max-w-2xl mx-auto">
                {metricas.map((m) => <LinhaKpi key={m.label} metrica={m} />)}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Funil de entrega</h2>
              <GraficoBarraDupla
                itens={[
                  { label: 'Enviado', valorA: analiseA.total, valorB: analiseB.total },
                  { label: 'Entregue', valorA: analiseA.entregues + analiseA.lidos, valorB: analiseB.entregues + analiseB.lidos },
                  { label: 'Lido', valorA: analiseA.lidos, valorB: analiseB.lidos },
                ]}
                nomeA={nomeA ?? 'Base A'}
                nomeB={nomeB ?? 'Base B'}
                corA={COR_A}
                corB={COR_B}
                formatarValor={formatNumero}
                alturaBarra={14}
              />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Velocidade de leitura</h2>
              <GraficoLinha
                series={[
                  { nome: nomeA ?? 'Base A', cor: COR_A, pontos: analiseA.faixasLeitura.map((f) => ({ label: f.label, valor: f.total })) },
                  { nome: nomeB ?? 'Base B', cor: COR_B, pontos: analiseB.faixasLeitura.map((f) => ({ label: f.label, valor: f.total })) },
                ]}
                formatarValor={formatNumero}
              />
            </section>
          </>
        )}
      </div>
    </>
  )
}
