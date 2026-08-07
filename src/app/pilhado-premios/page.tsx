'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pen, Trash2, Upload, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { calcularMetricasPilhado, formatPct } from '@/lib/resultadoPilhado'
import { formatNumero, formatMoeda, formatRoi } from '@/lib/resultadoDisparo'
import type { DisparoPilhado, DisparoDaxx } from '@/types'

const PAINEIS = ['kaue@3c.gg', 'thomas.almeida@3c.gg', 'gustavo@3c.gg']

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  const totais = disparos.reduce(
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
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setModalNovoAberto(true)}>
              Novo disparo
            </Button>
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

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : disparos.length === 0 ? (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhum disparo cadastrado ainda. Importe o CSV histórico ou cadastre um novo.
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
                  <th className="text-right py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {disparos.map((d) => {
                  const m = calcularMetricasPilhado(d)
                  return (
                    <tr key={d.id} className="glass bg-[var(--glass-bg)] border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover-bg)] transition-colors">
                      <td className="py-2 px-3 text-[var(--text-primary)] whitespace-nowrap">{d.data}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)] font-mono text-xs">{d.painel}</td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${d.origem === 'daxx' ? 'bg-[var(--d1)]/10 text-[var(--d1)]' : 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'}`}>
                          {d.origem === 'daxx' ? 'DAXX' : 'Manual'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{formatNumero(d.totalBase)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatNumero(d.entregues)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{formatPct(m.pctEntregues)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatNumero(d.lidas)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{formatPct(m.pctLidas)}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{formatMoeda(m.custo)}</td>
                      <td className="py-2 px-3 text-right font-mono">{d.vendas != null ? formatNumero(d.vendas) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono">{d.faturamento != null ? formatMoeda(d.faturamento) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{m.ticketMedio != null ? formatMoeda(m.ticketMedio) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{formatPct(m.conversao)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {m.roi != null ? (
                          <span className={m.roi >= 1 ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{formatRoi(m.roi)}</span>
                        ) : '—'}
                      </td>
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
                <tr className="border-t-2 border-[var(--glass-border)] font-semibold">
                  <td className="py-2 px-3" colSpan={3}>Total ({disparos.length})</td>
                  <td className="py-2 px-3 text-right font-mono">{formatNumero(totais.totalBase)}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatNumero(totais.entregues)}</td>
                  <td></td>
                  <td className="py-2 px-3 text-right font-mono">{formatNumero(totais.lidas)}</td>
                  <td></td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-400">{formatMoeda(totais.custo)}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatNumero(totais.vendas)}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatMoeda(totais.faturamento)}</td>
                  <td></td>
                  <td></td>
                  <td className="py-2 px-3 text-right font-mono">
                    {roiTotal != null ? (
                      <span className={roiTotal >= 1 ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{formatRoi(roiTotal)}</span>
                    ) : '—'}
                  </td>
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
              Vendas e faturamento ainda são sincronizados manualmente do painel h2premios (scraper automático vem a seguir).
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
