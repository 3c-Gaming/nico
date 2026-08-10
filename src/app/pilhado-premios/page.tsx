'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Pen, Trash2, Upload, RefreshCw, X, AlertTriangle, Check } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { Dropdown } from '@/components/ui/Dropdown'
import { calcularMetricasPilhado, formatPct } from '@/lib/resultadoPilhado'
import { formatNumero, formatMoeda, formatRoi } from '@/lib/resultadoDisparo'
import { PAINEIS_PILHADO } from '@/lib/pilhadoPremios'
import type { DisparoPilhado, DisparoDaxx } from '@/types'

const PAINEIS = PAINEIS_PILHADO

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

function primeiroDiaDoMesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function ultimoDiaDoMesAtual(): string {
  const d = new Date()
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
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
  const [sincronizando, setSincronizando] = useState<Record<string, boolean>>({})

  const [filtroPaineis, setFiltroPaineis] = useState<string[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState(primeiroDiaDoMesAtual)
  const [filtroDataFim, setFiltroDataFim] = useState(ultimoDiaDoMesAtual)

  const [sincronizandoMes, setSincronizandoMes] = useState(false)
  const [progressoSync, setProgressoSync] = useState<{ done: number; total: number } | null>(null)

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

  useEffect(() => { carregar() }, [carregar])

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

  async function sincronizarPainel(id: string) {
    setSincronizando((s) => ({ ...s, [id]: true }))
    setError(null)
    try {
      const res = await fetch(`/api/pilhado-premios/${id}/sincronizar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao sincronizar com o painel')
      await carregar()
    } catch (err) {
      setError(mensagemErroSync(err))
    } finally {
      setSincronizando((s) => ({ ...s, [id]: false }))
    }
  }

  async function sincronizarMes() {
    const desde = filtroDataInicio || primeiroDiaDoMesAtual()
    const paineisAlvo = filtroPaineis.length > 0 ? filtroPaineis : PAINEIS
    setSincronizandoMes(true)
    setError(null)
    setProgressoSync({ done: 0, total: paineisAlvo.length })
    try {
      const erros: string[] = []
      await Promise.all(
        paineisAlvo.map(async (painel) => {
          try {
            const res = await fetch('/api/pilhado-premios/sincronizar-painel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ painel, desde }),
            })
            const data = await res.json()
            if (!res.ok) erros.push(`${painel}: ${mensagemErroSync(new Error(data.error))}`)
          } catch (err) {
            erros.push(`${painel}: ${mensagemErroSync(err)}`)
          } finally {
            setProgressoSync((p) => (p ? { ...p, done: p.done + 1 } : p))
          }
        }),
      )
      if (erros.length > 0) setError(erros.join(' · '))
      await carregar()
    } finally {
      setSincronizandoMes(false)
      setProgressoSync(null)
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
    return disparos.filter((d) => {
      if (filtroPaineis.length > 0 && !filtroPaineis.includes(d.painel)) return false
      if (filtroDataInicio && d.data < filtroDataInicio) return false
      if (filtroDataFim && d.data > filtroDataFim) return false
      return true
    })
  }, [disparos, filtroPaineis, filtroDataInicio, filtroDataFim])

  const totais = disparosFiltrados.reduce(
    (acc, d) => {
      acc.totalBase += d.totalBase
      acc.entregues += d.entregues
      acc.lidas += d.lidas
      acc.vendas += d.vendas ?? 0
      acc.faturamento += d.faturamento ?? 0
      acc.custo += calcularMetricasPilhado(d).custo
      return acc
    },
    { totalBase: 0, entregues: 0, lidas: 0, vendas: 0, faturamento: 0, custo: 0 },
  )
  const roiTotal = totais.custo > 0 ? totais.faturamento / totais.custo : null
  const pctEntreguesTotal = totais.totalBase > 0 ? totais.entregues / totais.totalBase : null
  const pctLidasTotal = totais.entregues > 0 ? totais.lidas / totais.entregues : null
  const ticketMedioTotal = totais.vendas > 0 ? totais.faturamento / totais.vendas : null
  const conversaoTotal = totais.lidas > 0 ? totais.vendas / totais.lidas : null

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
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={sincronizandoMes ? 'animate-spin' : ''} />}
              onClick={sincronizarMes}
              disabled={sincronizandoMes}
              title="Busca vendas/faturamento no painel h2premios pro período filtrado"
            >
              {sincronizandoMes ? 'Sincronizando...' : 'Sincronizar mês'}
            </Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setModalNovoAberto(true)}>
              Novo disparo
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
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

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            />
            <span className="text-xs text-[var(--text-muted)]">até</span>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            />
          </div>

          {(filtroPaineis.length > 0 || filtroDataInicio !== primeiroDiaDoMesAtual() || filtroDataFim !== ultimoDiaDoMesAtual()) && (
            <button
              onClick={() => { setFiltroPaineis([]); setFiltroDataInicio(primeiroDiaDoMesAtual()); setFiltroDataFim(ultimoDiaDoMesAtual()) }}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={12} />
              Limpar filtros (voltar pro mês atual)
            </button>
          )}
        </div>

        {progressoSync && (
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--d1)] transition-all duration-300 ease-out"
                style={{ width: `${(progressoSync.done / progressoSync.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Sincronizando painéis com o h2premios... {progressoSync.done}/{progressoSync.total}
            </p>
          </div>
        )}

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
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Vendas</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Faturamento</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Tkt Médio</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Conv.</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">ROI</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Atualizado</th>
                  <th className="text-right py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {disparosFiltrados.map((d) => {
                  const m = calcularMetricasPilhado(d)
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
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{d.vendas != null ? formatNumero(d.vendas) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{d.faturamento != null ? formatMoeda(d.faturamento) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{m.ticketMedio != null ? formatMoeda(m.ticketMedio) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{formatPct(m.conversao)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {m.roi != null ? (
                          <span className={m.roi >= 1 ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{formatRoi(m.roi)}</span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 text-[10px] text-[var(--text-muted)] whitespace-nowrap">{formatarTempoRelativo(d.atualizadoEm)}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => sincronizarPainel(d.id)}
                            disabled={sincronizando[d.id]}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--d1)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40"
                            title="Atualizar vendas/faturamento do painel h2premios"
                          >
                            <RefreshCw size={13} className={sincronizando[d.id] ? 'animate-spin' : ''} />
                          </button>
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
                  <td className="py-2.5 px-3 text-right font-mono">{formatNumero(totais.vendas)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{formatMoeda(totais.faturamento)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{ticketMedioTotal != null ? formatMoeda(ticketMedioTotal) : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{conversaoTotal != null ? formatPct(conversaoTotal) : '—'}</td>
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
              Vendas e faturamento são sincronizados do painel h2premios pelo botão de atualizar (ícone de refresh na linha) ou automaticamente a cada hora.
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
    </>
  )
}
