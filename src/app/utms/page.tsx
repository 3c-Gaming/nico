'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Chip } from '@/components/ui/Chip'
import { useToast } from '@/components/ui/Toast'
import { useUtmConfigs } from '@/hooks/useUtmConfigs'
import { useResultadoUtmPeriodo } from '@/hooks/useResultadoDisparo'
import { formatNumero } from '@/lib/resultadoDisparo'
import { Plus, Trash2, Pencil, X, Check, Copy, Search } from 'lucide-react'
import type { UtmConfig } from '@/types'

const CASA_INFO = {
  superbet: { label: 'Superbet', short: 'ACID', cor: '#E11D48' },
  betmgm: { label: 'BetMGM', short: 'PID', cor: '#F59E0B' },
} as const

type Casa = keyof typeof CASA_INFO

function getLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** REG/FTD/CPA de uma UTM num período (inicio..fim, inclusive) — soma dia a dia da mesma
 * fonte/lógica do card do calendário (ver useResultadoUtmPeriodo). CPA só existe depois que TODOS
 * os dias do período já fecharam (a fonte de CPA não cobre hoje) — se o período inclui hoje, CPA
 * aparece como "—" mesmo com REG/FTD já preenchidos. */
function UtmStatCells({ valor, casa, dataInicio, dataFim }: { valor: string; casa: Casa; dataInicio: string; dataFim: string }) {
  const { resultado, carregando } = useResultadoUtmPeriodo({ utmValor: valor, casa, dataInicio, dataFim })
  const semDado = !resultado && carregando
  return (
    <>
      <span className="text-right text-sm font-mono text-[var(--text-primary)]">
        {semDado ? '…' : resultado ? formatNumero(resultado.registros) : '—'}
      </span>
      <span className="text-right text-sm font-mono text-[var(--d1)]">
        {semDado ? '…' : resultado ? formatNumero(resultado.ftds) : '—'}
      </span>
      <span
        className="text-right text-sm font-mono text-emerald-400"
        title={resultado && resultado.cpas == null ? 'CPA só fica disponível depois que o dia fecha' : undefined}
      >
        {semDado ? '…' : resultado?.cpas != null ? formatNumero(resultado.cpas) : '—'}
      </span>
    </>
  )
}

export default function UtmsPage() {
  const { list, add, update, remove } = useUtmConfigs()
  const { addToast } = useToast()

  const [busca, setBusca] = useState('')
  const [filtroCasa, setFiltroCasa] = useState<'all' | Casa>('all')
  const [dataInicioStats, setDataInicioStats] = useState(getLocalDate())
  const [dataFimStats, setDataFimStats] = useState(getLocalDate())

  const [novoAberto, setNovoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [novoCasa, setNovoCasa] = useState<Casa>('superbet')
  const [novoSiteId, setNovoSiteId] = useState('')

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editCasa, setEditCasa] = useState<Casa>('superbet')
  const [editSiteId, setEditSiteId] = useState('')

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return list
      .filter((item) => filtroCasa === 'all' || item.casa === filtroCasa)
      .filter(
        (item) =>
          !termo || item.nome.toLowerCase().includes(termo) || item.valor.toLowerCase().includes(termo)
      )
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [list, busca, filtroCasa])

  function handleCopy(item: UtmConfig) {
    navigator.clipboard.writeText(item.valor)
    addToast('success', `${CASA_INFO[item.casa].short} copiado`)
  }

  function handleStartNovo() {
    setNovoAberto(true)
    setNovoNome('')
    setNovoValor('')
    setNovoSiteId('')
    setNovoCasa(filtroCasa === 'all' ? 'superbet' : filtroCasa)
  }

  function handleCancelNovo() {
    setNovoAberto(false)
    setNovoNome('')
    setNovoValor('')
    setNovoSiteId('')
  }

  function handleSaveNovo() {
    if (!novoNome.trim() || !novoValor.trim()) return
    add({
      nome: novoNome.trim(),
      valor: novoValor.trim(),
      casa: novoCasa,
      siteId: novoCasa === 'superbet' ? novoSiteId.trim() || undefined : undefined,
    })
    addToast('success', 'Cadastrado com sucesso')
    handleCancelNovo()
  }

  function handleStartEdit(item: UtmConfig) {
    setEditandoId(item.id)
    setEditNome(item.nome)
    setEditValor(item.valor)
    setEditCasa(item.casa)
    setEditSiteId(item.siteId ?? '')
  }

  function handleCancelEdit() {
    setEditandoId(null)
  }

  function handleSaveEdit(id: string) {
    if (!editNome.trim() || !editValor.trim()) return
    update(id, {
      nome: editNome.trim(),
      valor: editValor.trim(),
      casa: editCasa,
      siteId: editCasa === 'superbet' ? editSiteId.trim() || undefined : undefined,
    })
    setEditandoId(null)
  }

  function handleRemove(item: UtmConfig) {
    if (!confirm(`Remover "${item.nome}"?`)) return
    remove(item.id)
    addToast('success', 'Removido')
  }

  return (
    <>
      <PageHeader titulo="UTMs" descricao="Cadastro de UTMs para tracking dos funis/disparos" />
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou valor..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]">
            {(['all', 'superbet', 'betmgm'] as const).map((opcao) => (
              <button
                key={opcao}
                onClick={() => setFiltroCasa(opcao)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${filtroCasa === opcao
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
              >
                {opcao === 'all' ? 'Todos' : CASA_INFO[opcao].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dataInicioStats}
              max={dataFimStats}
              onChange={(e) => setDataInicioStats(e.target.value)}
              title="Início do período dos números de REG/FTD/CPA"
              className="h-9 px-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
            <span className="text-xs text-[var(--text-muted)]">até</span>
            <input
              type="date"
              value={dataFimStats}
              min={dataInicioStats}
              onChange={(e) => setDataFimStats(e.target.value)}
              title="Fim do período dos números de REG/FTD/CPA"
              className="h-9 px-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={handleStartNovo} disabled={novoAberto}>
            Nova
          </Button>
        </div>

        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="grid grid-cols-9 gap-3 px-4 py-2 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)]">
            <span>Casa</span>
            <span>UTM</span>
            <span>Nome</span>
            <span>Valor</span>
            <span>Site ID</span>
            <span className="text-right">Reg</span>
            <span className="text-right">FTD</span>
            <span className="text-right">CPA</span>
            <span className="text-right">Ações</span>
          </div>

          {novoAberto && (
            <div className="grid grid-cols-5 gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-elevated)] items-center">
              <Select
                value={novoCasa}
                options={[
                  { value: 'superbet', label: 'Superbet' },
                  { value: 'betmgm', label: 'BetMGM' },
                ]}
                onChange={(e) => setNovoCasa(e.target.value as Casa)}
              />
              <input
                autoFocus
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="ex: superbet_junho_d1"
                className="h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
              />
              <input
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNovo()}
                placeholder={novoCasa === 'superbet' ? 'ex: superbet_junho_d1' : 'ex: 13382'}
                className="h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono focus:outline-none focus:border-[var(--border-strong)]"
              />
              <input
                value={novoSiteId}
                onChange={(e) => setNovoSiteId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNovo()}
                placeholder={novoCasa === 'superbet' ? 'ex: 25730' : '—'}
                disabled={novoCasa !== 'superbet'}
                className="h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono focus:outline-none focus:border-[var(--border-strong)] disabled:opacity-40"
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={handleSaveNovo}
                  className="flex items-center justify-center w-7 h-7 rounded text-[var(--success)] hover:bg-[var(--success)]/10"
                  title="Salvar"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={handleCancelNovo}
                  className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  title="Cancelar"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {itensFiltrados.length === 0 && !novoAberto && (
            <p className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
              {list.length === 0 ? 'Nenhum cadastrado' : 'Nenhum resultado para o filtro atual'}
            </p>
          )}

          {itensFiltrados.map((item) => {
            const info = CASA_INFO[item.casa]
            const editando = editandoId === item.id

            if (editando) {
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-5 gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-b-0 bg-[var(--bg-elevated)] items-center"
                >
                  <Select
                    value={editCasa}
                    options={[
                      { value: 'superbet', label: 'Superbet' },
                      { value: 'betmgm', label: 'BetMGM' },
                    ]}
                    onChange={(e) => setEditCasa(e.target.value as Casa)}
                  />
                  <input
                    autoFocus
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
                  />
                  <input
                    value={editValor}
                    onChange={(e) => setEditValor(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.id)}
                    className="h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--border-strong)]"
                  />
                  <input
                    value={editSiteId}
                    onChange={(e) => setEditSiteId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.id)}
                    placeholder={editCasa === 'superbet' ? 'ex: 25730' : '—'}
                    disabled={editCasa !== 'superbet'}
                    className="h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono focus:outline-none focus:border-[var(--border-strong)] disabled:opacity-40"
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      className="flex items-center justify-center w-7 h-7 rounded text-[var(--success)] hover:bg-[var(--success)]/10"
                      title="Salvar"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                      title="Cancelar"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={item.id}
                className="group grid grid-cols-9 gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-b-0 items-center hover:bg-[var(--bg-elevated)]/50 transition-colors"
              >
                <div className="flex items-center">
                  <Chip label={info.label} cor={info.cor} size="md" />
                </div>
                <span className="text-sm text-[var(--text-primary)] truncate" title={info.short}>
                  {info.short}
                </span>
                <span className="text-sm text-[var(--text-primary)] truncate" title={item.nome}>
                  {item.nome}
                </span>
                <span className="text-sm text-[var(--text-muted)] font-mono truncate" title={item.valor}>
                  {item.valor}
                </span>
                <span className="text-sm text-[var(--text-muted)] font-mono truncate">
                  {item.casa === 'superbet' ? (item.siteId || '—') : '—'}
                </span>
                <UtmStatCells valor={item.valor} casa={item.casa} dataInicio={dataInicioStats} dataFim={dataFimStats} />
                <div className="grid grid-cols-3 text-text-primary">
                  <button
                    onClick={() => handleCopy(item)}
                    className="flex items-center justify-center h-7 rounded opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] cursor-pointer transition-colors"
                    title={`Copiar ${info.short}`}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleStartEdit(item)}
                    className="flex items-center justify-center h-7 rounded opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] cursor-pointer transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleRemove(item)}
                    className="flex items-center justify-center h-7 rounded opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
