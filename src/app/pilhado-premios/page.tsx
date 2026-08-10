'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Pen, Trash2, Upload, Download, MessageCircle, RefreshCw, X, AlertTriangle, Check, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { Dropdown } from '@/components/ui/Dropdown'
import { calcularMetricasPilhado, formatPct } from '@/lib/resultadoPilhado'
import { formatNumero, formatMoeda, formatRoi } from '@/lib/resultadoDisparo'
import { PAINEIS_PILHADO } from '@/lib/pilhadoPremios'
import type { DisparoPilhado, DisparoDaxx, PilhadoPremiosConfig } from '@/types'

const PAINEIS = PAINEIS_PILHADO

interface Edicao {
  id: string
  label: string
}

function formatarTempoRelativo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `há ${diffD}d`
}

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mensagemErroSync(err: unknown): string {
  const msg = (err as Error).message || ''
  if (/abort|timeout/i.test(msg)) return 'A sincronização demorou demais e foi interrompida — tente novamente em alguns instantes.'
  return msg || 'Erro ao sincronizar'
}

interface FormManual {
  data: string
  painel: string
  totalBase: string
  entregues: string
  lidas: string
}

const FORM_VAZIO: FormManual = { data: hoje(), painel: PAINEIS[0], totalBase: '', entregues: '', lidas: '' }

export default function PilhadoPremiosPage() {
  const [disparos, setDisparos] = useState<DisparoPilhado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [configs, setConfigs] = useState<PilhadoPremiosConfig[]>([])
  const [sincronizandoPainel, setSincronizandoPainel] = useState<Record<string, boolean>>({})

  const [seletorEdicaoPainel, setSeletorEdicaoPainel] = useState<string | null>(null)
  const [edicoesDisponiveis, setEdicoesDisponiveis] = useState<Edicao[]>([])
  const [carregandoEdicoes, setCarregandoEdicoes] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [modoNovo, setModoNovo] = useState<'daxx' | 'manual'>('manual')
  const [daxxDisponiveis, setDaxxDisponiveis] = useState<DisparoDaxx[]>([])
  const [carregandoDaxx, setCarregandoDaxx] = useState(false)
  const [formManual, setFormManual] = useState<FormManual>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  const [editando, setEditando] = useState<DisparoPilhado | null>(null)
  const [formEdit, setFormEdit] = useState<FormManual>(FORM_VAZIO)

  const [importando, setImportando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [filtroPaineis, setFiltroPaineis] = useState<string[]>([])

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pilhado-premios')
      if (!res.ok) throw new Error('Erro ao carregar disparos')
      const data = await res.json()
      setDisparos(data.disparos ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/pilhado-premios/config')
      if (!res.ok) return
      const data = await res.json()
      setConfigs(data.configs ?? [])
    } catch {
      // resumo por painel é complementar — falha aqui não deve travar a tela toda
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { carregarConfigs() }, [carregarConfigs])

  useEffect(() => {
    if (!modalNovoAberto || modoNovo !== 'daxx' || daxxDisponiveis.length > 0) return
    setCarregandoDaxx(true)
    fetch('/api/pilhado-premios/daxx-disponiveis')
      .then((r) => (r.ok ? r.json() : { campanhas: [] }))
      .then((data) => setDaxxDisponiveis(data.campanhas ?? []))
      .catch(() => {})
      .finally(() => setCarregandoDaxx(false))
  }, [modalNovoAberto, modoNovo, daxxDisponiveis.length])

  async function criarViaDaxx(campanha: DisparoDaxx) {
    setSalvando(true)
    try {
      const agora = new Date().toISOString()
      const disparo: DisparoPilhado = {
        id: crypto.randomUUID(),
        data: hoje(),
        painel: PAINEIS[0],
        origem: 'daxx',
        daxxCampanhaId: campanha.id,
        nomenclatura: campanha.nome,
        totalBase: campanha.totalBase,
        entregues: campanha.entregues,
        lidas: campanha.lidas,
        criadoEm: agora,
        atualizadoEm: agora,
      }
      const res = await fetch('/api/pilhado-premios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disparo }),
      })
      if (!res.ok) throw new Error('Erro ao cadastrar disparo')
      setModalNovoAberto(false)
      setDaxxDisponiveis([])
      await carregar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function criarManual() {
    setSalvando(true)
    try {
      const agora = new Date().toISOString()
      const disparo: DisparoPilhado = {
        id: crypto.randomUUID(),
        data: formManual.data,
        painel: formManual.painel,
        origem: 'manual',
        totalBase: Number(formManual.totalBase) || 0,
        entregues: Number(formManual.entregues) || 0,
        lidas: Number(formManual.lidas) || 0,
        criadoEm: agora,
        atualizadoEm: agora,
      }
      const res = await fetch('/api/pilhado-premios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disparo }),
      })
      if (!res.ok) throw new Error('Erro ao cadastrar disparo')
      setModalNovoAberto(false)
      setFormManual(FORM_VAZIO)
      await carregar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  function abrirEdicao(d: DisparoPilhado) {
    setEditando(d)
    setFormEdit({
      data: d.data,
      painel: d.painel,
      totalBase: String(d.totalBase),
      entregues: String(d.entregues),
      lidas: String(d.lidas),
    })
  }

  async function salvarEdicao() {
    if (!editando) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/pilhado-premios/${editando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: formEdit.data,
          painel: formEdit.painel,
          totalBase: Number(formEdit.totalBase) || 0,
          entregues: Number(formEdit.entregues) || 0,
          lidas: Number(formEdit.lidas) || 0,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar edição')
      setEditando(null)
      await carregar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este disparo?')) return
    const res = await fetch(`/api/pilhado-premios/${id}`, { method: 'DELETE' })
    if (res.ok) await carregar()
  }

  async function sincronizarPainelAgora(painel: string) {
    setSincronizandoPainel((s) => ({ ...s, [painel]: true }))
    setError(null)
    try {
      const res = await fetch('/api/pilhado-premios/sincronizar-painel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ painel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao sincronizar com o painel')
      await carregarConfigs()
    } catch (err) {
      setError(mensagemErroSync(err))
    } finally {
      setSincronizandoPainel((s) => ({ ...s, [painel]: false }))
    }
  }

  function abrirSeletorEdicao(painel: string) {
    setSeletorEdicaoPainel(painel)
    setEdicoesDisponiveis([])
    setCarregandoEdicoes(true)
    fetch(`/api/pilhado-premios/edicoes?painel=${encodeURIComponent(painel)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Erro ao buscar edições'))))
      .then((data) => setEdicoesDisponiveis(data.edicoes ?? []))
      .catch((err) => setError(mensagemErroSync(err)))
      .finally(() => setCarregandoEdicoes(false))
  }

  async function escolherEdicao(edicao: Edicao) {
    if (!seletorEdicaoPainel) return
    setSalvandoEdicao(true)
    setError(null)
    try {
      const res = await fetch('/api/pilhado-premios/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ painel: seletorEdicaoPainel, edicaoId: edicao.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar edição')
      setSeletorEdicaoPainel(null)
      await carregarConfigs()
    } catch (err) {
      setError(mensagemErroSync(err))
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function handleImportarCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/pilhado-premios/importar-csv', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao importar CSV')
      await carregar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImportando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const disparosFiltrados = useMemo(() => {
    return disparos.filter((d) => filtroPaineis.length === 0 || filtroPaineis.includes(d.painel))
  }, [disparos, filtroPaineis])

  const configPorPainel = useMemo(() => {
    const mapa = new Map<string, PilhadoPremiosConfig>()
    for (const c of configs) mapa.set(c.painel, c)
    return mapa
  }, [configs])

  const totais = disparosFiltrados.reduce(
    (acc, d) => {
      acc.totalBase += d.totalBase
      acc.entregues += d.entregues
      acc.lidas += d.lidas
      acc.custo += calcularMetricasPilhado(d).custo
      return acc
    },
    { totalBase: 0, entregues: 0, lidas: 0, custo: 0 },
  )
  const pctEntreguesTotal = totais.totalBase > 0 ? totais.entregues / totais.totalBase : null
  const pctLidasTotal = totais.entregues > 0 ? totais.lidas / totais.entregues : null

  // Faturamento/ticket médio/ROI não são por disparo (vêm do resumo do painel/edição) — o total
  // soma a Receita de vendas de cada painel ÚNICO presente no filtro, não por linha, senão um
  // painel com 3 disparos contaria o mesmo faturamento 3 vezes.
  const paineisFiltrados = useMemo(() => [...new Set(disparosFiltrados.map((d) => d.painel))], [disparosFiltrados])
  const faturamentoTotal = paineisFiltrados.reduce((soma, p) => soma + (configPorPainel.get(p)?.receitaVendas ?? 0), 0)
  const comprasTotal = paineisFiltrados.reduce((soma, p) => soma + (configPorPainel.get(p)?.quantidadeCompras ?? 0), 0)
  const ticketMedioTotal = comprasTotal > 0 ? faturamentoTotal / comprasTotal : null
  const roiTotal = totais.custo > 0 ? faturamentoTotal / totais.custo : null

  function exportarCsv() {
    const cabecalho = ['Data', 'Painel', 'Origem', 'Base', 'Entregues', '% Entregues', 'Lidas', '% Lidas', 'Custo', 'Tkt Médio', 'Compras', 'Faturamento', 'ROI', 'Atualizado']
    const linhas = disparosFiltrados.map((d) => {
      const m = calcularMetricasPilhado(d)
      const config = configPorPainel.get(d.painel)
      const faturamento = config?.receitaVendas ?? null
      const ticketMedio = config?.ticketMedio ?? null
      const compras = config?.quantidadeCompras ?? null
      const roi = faturamento != null && m.custo > 0 ? faturamento / m.custo : null
      return [
        d.data,
        d.painel,
        d.origem === 'daxx' ? 'DAXX' : 'Manual',
        formatNumero(d.totalBase),
        formatNumero(d.entregues),
        formatPct(m.pctEntregues),
        formatNumero(d.lidas),
        formatPct(m.pctLidas),
        formatMoeda(m.custo),
        ticketMedio != null ? formatMoeda(ticketMedio) : '',
        compras != null ? formatNumero(compras) : '',
        faturamento != null ? formatMoeda(faturamento) : '',
        roi != null ? formatRoi(roi) : '',
        d.atualizadoEm,
      ]
    })

    // Ponto-e-vírgula como separador (não vírgula) — os valores já vêm formatados em pt-BR
    // (ex: "R$ 3.312,03"), que usa vírgula como separador decimal; com vírgula como delimitador
    // o Excel quebraria essas colunas ao meio.
    const csvEscape = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const csv = [cabecalho, ...linhas].map((linha) => linha.map(csvEscape).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pilhado-premios-${hoje()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportarWhatsApp() {
    const blocos = PAINEIS.map((painel) => {
      const config = configPorPainel.get(painel)
      if (!config) return `*${painel}*\nNenhuma edição configurada`
      return [
        `*${painel}*`,
        config.edicaoLabel ? `Edição: ${config.edicaoLabel}` : null,
        `Receita de vendas: ${config.receitaVendas != null ? formatMoeda(config.receitaVendas) : '—'}`,
        `Ticket médio: ${config.ticketMedio != null ? formatMoeda(config.ticketMedio) : '—'}`,
        `Compras: ${config.quantidadeCompras != null ? formatNumero(config.quantidadeCompras) : '—'}`,
        `Atualizado: ${formatarTempoRelativo(config.atualizadoEm)}`,
      ].filter(Boolean).join('\n')
    })

    const mensagem = [
      // Sem emoji aqui: confirmado que o redirect do wa.me corrompe caracteres fora do plano
      // básico (emoji) no parâmetro "text", trocando por U+FFFD — reproduzido isolado, direto no
      // wa.me, sem nada do nosso código envolvido.
      '*Pilhado Prêmios* — Resumo por painel',
      '',
      blocos.join('\n\n'),
      '',
      `Total: ${formatMoeda(faturamentoTotal)} · ${formatNumero(comprasTotal)} compras`,
    ].join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank')
  }

  return (
    <>
      <PageHeader
        titulo="Pilhado Prêmios"
        descricao="Monitoramento consolidado dos disparos do braço Pilhado Prêmios"
        acoes={
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportarCsv} />
            <Button
              variant="secondary"
              size="sm"
              icon={importando ? <Spinner size={14} /> : <Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={importando}
            >
              {importando ? 'Importando...' : 'Importar CSV'}
            </Button>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={carregar} disabled={loading}>
              Recarregar
            </Button>
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportarCsv} disabled={disparosFiltrados.length === 0}>
              Exportar CSV
            </Button>
            <Button variant="secondary" size="sm" icon={<MessageCircle size={14} />} onClick={exportarWhatsApp}>
              Exportar via WhatsApp
            </Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setModalNovoAberto(true)}>
              Novo disparo
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Resumo por painel — vendas/faturamento vêm da Edição escolhida manualmente no h2premios,
            não têm atribuição por dia/disparo (ver nota no modal de editar disparo). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PAINEIS.map((painel) => {
            const config = configPorPainel.get(painel)
            const sincronizando = !!sincronizandoPainel[painel]
            return (
              <div key={painel} className="glass bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-[var(--text-muted)] truncate">{painel}</div>
                    <div className="text-xs text-[var(--text-primary)] truncate mt-0.5" title={config?.edicaoLabel ?? undefined}>
                      {config?.edicaoLabel ?? 'Nenhuma edição configurada'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => sincronizarPainelAgora(painel)}
                      disabled={sincronizando || !config}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--d1)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40"
                      title="Sincronizar com o h2premios"
                    >
                      <RefreshCw size={13} className={sincronizando ? 'animate-spin' : ''} />
                    </button>
                    <button
                      onClick={() => abrirSeletorEdicao(painel)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                      title="Escolher edição"
                    >
                      <Settings2 size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Receita de vendas</div>
                  <div className="text-xl font-semibold text-emerald-400">
                    {config?.receitaVendas != null ? formatMoeda(config.receitaVendas) : '—'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Ticket médio</div>
                    <div className="text-sm font-mono text-[var(--text-primary)]">
                      {config?.ticketMedio != null ? formatMoeda(config.ticketMedio) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Compras</div>
                    <div className="text-sm font-mono text-[var(--text-primary)]">
                      {config?.quantidadeCompras != null ? formatNumero(config.quantidadeCompras) : '—'}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-[var(--text-muted)]">Atualizado {formatarTempoRelativo(config?.atualizadoEm)}</div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Dropdown label={`Painel${filtroPaineis.length > 0 ? ` (${filtroPaineis.length})` : ''}`}>
            <div className="p-1 min-w-[200px]">
              {PAINEIS.map((p) => {
                const selected = filtroPaineis.includes(p)
                return (
                  <button
                    key={p}
                    onClick={() => setFiltroPaineis((prev) => selected ? prev.filter((x) => x !== p) : [...prev, p])}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
                  >
                    <span className="flex-1 text-left font-mono text-xs">{p}</span>
                    {selected && <Check size={14} className="text-[var(--d1)]" />}
                  </button>
                )
              })}
            </div>
          </Dropdown>

          {filtroPaineis.length > 0 && (
            <button
              onClick={() => setFiltroPaineis([])}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={12} />
              Limpar filtro
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : disparos.length === 0 ? (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum disparo cadastrado ainda. Importe o CSV histórico ou cadastre um novo.
          </div>
        ) : disparosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum disparo encontrado com esses filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Data</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Painel</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Origem</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Base</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Entregues</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">% Ent.</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Lidas</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">% Lidas</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Custo</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Tkt Médio</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Compras</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Faturamento</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">ROI</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Atualizado</th>
                  <th className="text-right py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {disparosFiltrados.map((d) => {
                  const m = calcularMetricasPilhado(d)
                  const config = configPorPainel.get(d.painel)
                  const faturamento = config?.receitaVendas ?? null
                  const ticketMedio = config?.ticketMedio ?? null
                  const compras = config?.quantidadeCompras ?? null
                  const roi = faturamento != null && m.custo > 0 ? faturamento / m.custo : null
                  return (
                    <tr key={d.id} className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors">
                      <td className="py-2 px-3 text-[var(--text-primary)] whitespace-nowrap">{d.data}</td>
                      <td className="py-2 px-3 text-[var(--text-primary)] font-mono text-xs">{d.painel}</td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${d.origem === 'daxx' ? 'bg-[var(--d1)]/10 text-[var(--d1)]' : 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'}`}>
                          {d.origem === 'daxx' ? 'DAXX' : 'Manual'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{formatNumero(d.totalBase)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{formatNumero(d.entregues)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{formatPct(m.pctEntregues)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{formatNumero(d.lidas)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{formatPct(m.pctLidas)}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{formatMoeda(m.custo)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{ticketMedio != null ? formatMoeda(ticketMedio) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{compras != null ? formatNumero(compras) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{faturamento != null ? formatMoeda(faturamento) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {roi != null ? (
                          <span className={roi >= 1 ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{formatRoi(roi)}</span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 text-[10px] text-[var(--text-muted)] whitespace-nowrap">{formatarTempoRelativo(d.atualizadoEm)}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => abrirEdicao(d)} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors" title="Editar">
                            <Pen size={13} />
                          </button>
                          <button onClick={() => excluir(d.id)} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-elevated)] transition-colors" title="Excluir">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--d1)]/40 bg-[var(--bg-elevated)] font-semibold">
                  <td className="py-2.5 px-3" colSpan={3}>Total ({disparosFiltrados.length})</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatNumero(totais.totalBase)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatNumero(totais.entregues)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{pctEntreguesTotal != null ? formatPct(pctEntreguesTotal) : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatNumero(totais.lidas)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{pctLidasTotal != null ? formatPct(pctLidasTotal) : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{formatMoeda(totais.custo)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{ticketMedioTotal != null ? formatMoeda(ticketMedioTotal) : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatNumero(comprasTotal)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{formatMoeda(faturamentoTotal)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {roiTotal != null ? (
                      <span className={roiTotal >= 1 ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{formatRoi(roiTotal)}</span>
                    ) : '—'}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal: novo disparo */}
      <Modal open={modalNovoAberto} onClose={() => setModalNovoAberto(false)} title="Novo disparo — Pilhado Prêmios" width="560px">
        <div className="space-y-4">
          <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--border)] rounded p-0.5 w-fit">
            <button
              onClick={() => setModoNovo('manual')}
              className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${modoNovo === 'manual' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Manual
            </button>
            <button
              onClick={() => setModoNovo('daxx')}
              className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${modoNovo === 'daxx' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Via DAXX
            </button>
          </div>

          {modoNovo === 'manual' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Data</label>
                  <input
                    type="date"
                    value={formManual.data}
                    onChange={(e) => setFormManual((f) => ({ ...f, data: e.target.value }))}
                    className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Painel</label>
                  <select
                    value={formManual.painel}
                    onChange={(e) => setFormManual((f) => ({ ...f, painel: e.target.value }))}
                    className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                  >
                    {PAINEIS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Base total</label>
                  <input
                    type="number"
                    value={formManual.totalBase}
                    onChange={(e) => setFormManual((f) => ({ ...f, totalBase: e.target.value }))}
                    className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Entregues</label>
                  <input
                    type="number"
                    value={formManual.entregues}
                    onChange={(e) => setFormManual((f) => ({ ...f, entregues: e.target.value }))}
                    className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Lidas</label>
                  <input
                    type="number"
                    value={formManual.lidas}
                    onChange={(e) => setFormManual((f) => ({ ...f, lidas: e.target.value }))}
                    className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={criarManual} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Cadastrar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)]">
                Campanhas DAXX pontuais com &quot;PILHADO PREMIOS&quot; no nome ainda não cadastradas.
              </p>
              {carregandoDaxx ? (
                <div className="flex justify-center py-8"><Spinner size={24} /></div>
              ) : daxxDisponiveis.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]/60 italic py-4 text-center">Nenhuma campanha disponível.</p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto space-y-1.5">
                  {daxxDisponiveis.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => criarViaDaxx(c)}
                      disabled={salvando}
                      className="w-full text-left p-2.5 rounded border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50"
                    >
                      <div className="text-xs font-mono text-[var(--text-primary)] truncate">{c.nome}</div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">
                        Base {formatNumero(c.totalBase)} · Entregues {formatNumero(c.entregues)} · Lidas {formatNumero(c.lidas)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: editar disparo */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar disparo" width="480px">
        {editando && (
          <div className="space-y-3">
            {editando.origem === 'daxx' && editando.nomenclatura && (
              <p className="text-[10px] text-[var(--text-muted)] font-mono truncate" title={editando.nomenclatura}>
                {editando.nomenclatura}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Data</label>
                <input
                  type="date"
                  value={formEdit.data}
                  onChange={(e) => setFormEdit((f) => ({ ...f, data: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Painel</label>
                <select
                  value={formEdit.painel}
                  onChange={(e) => setFormEdit((f) => ({ ...f, painel: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                >
                  {PAINEIS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Base total</label>
                <input
                  type="number"
                  value={formEdit.totalBase}
                  onChange={(e) => setFormEdit((f) => ({ ...f, totalBase: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Entregues</label>
                <input
                  type="number"
                  value={formEdit.entregues}
                  onChange={(e) => setFormEdit((f) => ({ ...f, entregues: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Lidas</label>
                <input
                  type="number"
                  value={formEdit.lidas}
                  onChange={(e) => setFormEdit((f) => ({ ...f, lidas: e.target.value }))}
                  className="w-full h-8 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              A data acima é só informativa (dia em que o disparo saiu). Faturamento/ticket médio/ROI na tabela vêm do resumo do painel (mesma edição pra todos os disparos daquele painel), não são calculados por disparo individual.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={salvarEdicao} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: escolher edição do painel */}
      <Modal open={!!seletorEdicaoPainel} onClose={() => setSeletorEdicaoPainel(null)} title={`Escolher edição — ${seletorEdicaoPainel ?? ''}`} width="480px">
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            O painel h2premios não indica qual edição está ativa — a mais nova pode ainda estar zerada. Escolha manualmente qual edição usar pra este painel.
          </p>
          {carregandoEdicoes ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : edicoesDisponiveis.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]/60 italic py-4 text-center">Nenhuma edição encontrada.</p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto space-y-1.5">
              {edicoesDisponiveis.map((edicao) => (
                <button
                  key={edicao.id}
                  onClick={() => escolherEdicao(edicao)}
                  disabled={salvandoEdicao}
                  className="w-full text-left p-2.5 rounded border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50 text-xs text-[var(--text-primary)]"
                >
                  {edicao.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
