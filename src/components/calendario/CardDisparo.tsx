'use client'

import { useState } from 'react'
import type { ItemCalendario, StatusDisparo, Disparo } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useEsteiras } from '@/hooks/useEsteiras'
import { getState } from '@/lib/store'
import { criarEsteira } from '@/lib/esteira'
import { parsearNomeCampanhaDaxx } from '@/lib/daxx-parser'
import { useUtmConfigs } from '@/hooks/useUtmConfigs'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { StatusDot } from '../ui/StatusDot'
import { Modal } from '../ui/Modal'
import { Dropdown } from '../ui/Dropdown'
import { useToast } from '../ui/Toast'
import { ExternalLink, Trash2, Play, Check, Clock, Database } from 'lucide-react'
import Link from 'next/link'

function fireAndForget(url: string, opts: RequestInit) {
  fetch(url, opts).catch(() => {})
}

const TIPO_CORES: Record<string, string> = {
  D1: 'var(--d1)',
  D3: 'var(--d3)',
  D5: 'var(--d5)',
  D7: 'var(--d7)',
  PONTUAL: 'var(--pontual)',
}

const STATUS_DISPONIVEIS: { value: StatusDisparo; label: string }[] = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'pronto', label: 'Pronto' },
  { value: 'em_validacao', label: 'Em Validação' },
  { value: 'executado', label: 'Executado' },
  { value: 'cancelado', label: 'Cancelado' },
]

interface CardItemCalendarioProps {
  item: ItemCalendario
}

function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function CardItemCalendario({ item }: CardItemCalendarioProps) {
  const [open, setOpen] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const { update, remove, create } = useDisparos()
  const { getById, create: createEsteira } = useEsteiras()
  const { casas, list: casasList } = useCasasAposta()
  const { list: utmConfigs } = useUtmConfigs()
  const { addToast } = useToast()

  const cor = TIPO_CORES[item.tipo] ?? 'var(--text-secondary)'
  const esteira = item.disparoLocal?.esteiraPaiId ? getById(item.disparoLocal.esteiraPaiId) : null

  function handleStatusChange(status: StatusDisparo) {
    if (!item.disparoLocal) return
    update(item.disparoLocal.id, { status })
    addToast('success', `Status alterado para ${status.replace('_', ' ')}`)
  }

  function handleExecutar() {
    if (!item.disparoLocal) return
    update(item.disparoLocal.id, { status: 'executado' })
    addToast('success', `${item.tipo} marcado como executado`)
    setOpen(false)
  }

  function handleDelete() {
    if (!item.disparoLocal) return
    if (confirm('Tem certeza que deseja apagar este disparo?')) {
      remove(item.disparoLocal.id)
      addToast('success', 'Disparo removido')
      setOpen(false)
    }
  }

  function handleCadastrar() {
    const campanha = item.campanhaDaxx
    if (!campanha || !item.tipo || cadastrando) return
    setCadastrando(true)

    try {
      const now = new Date().toISOString()
      const baseNome = parsearNomeCampanhaDaxx(campanha.nome).baseNome?.toLowerCase()
      const casasAposta = baseNome
        ? casasList
            .filter((c) => baseNome.includes(c.slug.toLowerCase()) || c.slug.toLowerCase().includes(baseNome) || baseNome.includes(c.nome.toLowerCase()))
            .map((c) => c.id)
        : []

      const disparoData: Disparo = {
        id: crypto.randomUUID(),
        tipo: item.tipo,
        nomenclatura: campanha.nome,
        status: 'rascunho',
        casasAposta,
        dataDisparo: item.dataDisparo,
        horarioDisparo: '09:30',
        base: {
          status: 'disponivel',
          totalRegistros: campanha.totalBase,
          nomeArquivo: `DAXX: ${campanha.nome}`,
        },
        templateDaxx: {
          id: campanha.id,
          nome: campanha.nome,
          url: campanha.linkTemplate,
          descricao: `Base: ${campanha.totalBase} | Entregues: ${campanha.entregues} | Lidas: ${campanha.lidas}`,
        },
        criadoEm: now,
        atualizadoEm: now,
        valorTotalBase: campanha.totalBase,
        conversao: {
          entreguesDaxx: campanha.entregues,
          leadsFluxo: 0,
          atualizadoEm: now,
        },
      }

      if (item.tipo === 'D1') {
        const etapaConfigs = getState().etapaConfigs
        const { esteira, filhos } = criarEsteira(disparoData, casasList, etapaConfigs)
        create(disparoData)
        for (const f of filhos) create(f)
        createEsteira(esteira)
        fireAndForget('/api/disparos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disparo: disparoData, esteira, filhos }),
        })
      } else {
        create(disparoData)
        fireAndForget('/api/disparos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disparo: disparoData }),
        })
      }

      addToast('success', `${item.tipo} cadastrado a partir da DAXX`)
      setOpen(false)
    } finally {
      setCadastrando(false)
    }
  }

  if (item.fonte === 'daxx') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left rounded p-2.5 transition-all duration-150 group"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px dashed var(--border-strong)',
            borderLeft: `3px solid ${cor}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold" style={{ color: cor }}>{item.tipo}</span>
            <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--border)] text-[var(--text-muted)]">
              <Database size={9} />
              DAXX
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mb-1">
            {item.casasAposta.map((casaId) => {
              const casa = casas[casaId]
              if (!casa) return null
              return <Chip key={casaId} label={casa.nome} cor={casa.cor} size="sm" />
            })}
          </div>
          <p className="font-mono text-[11px] text-[var(--text-secondary)] truncate mb-1" title={item.nome}>
            {item.nome}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="capitalize">{item.status}</span>
            {item.totalBase != null && (
              <>
                <span>·</span>
                <span>{formatNumero(item.totalBase)} base</span>
              </>
            )}
          </div>
          {(item.entregues != null || item.lidas != null) && (
            <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
              {item.entregues != null && <span>Enviados: {formatNumero(item.entregues)}</span>}
              {item.lidas != null && <span>Lidos: {formatNumero(item.lidas)}</span>}
              {item.rejeitados != null && item.rejeitados > 0 && <span className="text-[var(--error)]">Rej: {formatNumero(item.rejeitados)}</span>}
            </div>
          )}
        </button>

        <Modal open={open} onClose={() => setOpen(false)} title={item.nome}>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Tipo</span>
                <Badge variant="tipo" value={item.tipo} />
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Status DAXX</span>
                <span className="text-[var(--text-primary)]">{item.status}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Data</span>
                <span className="text-[var(--text-primary)]">{item.dataDisparo}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Base</span>
                <span className="text-[var(--text-primary)]">{item.totalBase != null ? formatNumero(item.totalBase) : '—'}</span>
              </div>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Métricas</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.entregues != null ? formatNumero(item.entregues) : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Enviados</div>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.lidas != null ? formatNumero(item.lidas) : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Lidos</div>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.rejeitados != null ? formatNumero(item.rejeitados) : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Rejeitados</div>
                </div>
              </div>
            </div>
            {item.campanhaDaxx?.responsavel && (
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Responsável</span>
                <span className="text-[var(--text-primary)]">{item.campanhaDaxx.responsavel}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-[var(--border)]">
            <Button
              variant="primary"
              size="sm"
              icon={<Check size={14} />}
              onClick={handleCadastrar}
              disabled={cadastrando}
            >
              {cadastrando ? 'Cadastrando...' : 'Cadastrar disparo'}
            </Button>
          </div>
        </Modal>
      </>
    )
  }

  if (item.fonte === 'agendado') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left rounded p-2.5 transition-all duration-150 group"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--info)',
            borderLeft: '3px solid var(--info)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold text-[var(--info)]">{item.tipo}</span>
            <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--info)]/30 text-[var(--info)]">
              <Clock size={9} />
              Agendado
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mb-1">
            {item.casasAposta.map((casaId) => {
              const casa = casas[casaId]
              if (!casa) return null
              return <Chip key={casaId} label={casa.nome} cor={casa.cor} size="sm" />
            })}
          </div>
          <p className="font-mono text-[11px] text-[var(--text-secondary)] truncate mb-1">
            {item.nome}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="capitalize">{item.status}</span>
          </div>
        </button>

        <Modal open={open} onClose={() => setOpen(false)} title={item.nome}>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Tipo</span>
                <Badge variant="tipo" value={item.tipo} />
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Status</span>
                <span className="text-[var(--text-primary)]">{item.status}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Data Agendada</span>
                <span className="text-[var(--text-primary)]">{item.dataDisparo}</span>
              </div>
            </div>
            {item.agendado?.marcas?.nome && (
              <div>
                <span className="text-[var(--text-muted)] block text-xs">Marca</span>
                <span className="text-[var(--text-primary)]">{item.agendado.marcas.nome}</span>
              </div>
            )}
          </div>
        </Modal>
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded p-2.5 transition-all duration-150 group"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${cor}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold" style={{ color: cor }}>
            {item.tipo}
          </span>
          {item.status !== 'executado' && item.status !== 'cancelado' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                handleExecutar()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  handleExecutar()
                }
              }}
              className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity border border-[var(--border)] text-[var(--d1)] hover:bg-[var(--d1)]/10 cursor-pointer"
              title="Executar agora"
            >
              <Play size={10} />
              Executar
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-1">
          {item.casasAposta.map((casaId) => {
            const casa = casas[casaId]
            if (!casa) return null
            return <Chip key={casaId} label={casa.nome} cor={casa.cor} size="sm" />
          })}
        </div>

        <p className="font-mono text-[11px] text-[var(--text-secondary)] truncate mb-1">
          {item.nomenclatura}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span>{item.horarioDisparo}</span>
          <span>·</span>
          {item.fonte === 'local' ? (
            <StatusDot status={item.status as StatusDisparo} size={6} />
          ) : (
            <span className="inline-block rounded-full" style={{ width: 6, height: 6, backgroundColor: 'var(--text-muted)' }} />
          )}
          <span className="capitalize">{item.status.replace('_', ' ')}</span>
          {item.entregues != null && (
            <>
              <span>·</span>
              <span className="text-[var(--success)]">{formatNumero(item.entregues)} env.</span>
            </>
          )}
        </div>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={item.nomenclatura}>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Tipo</span>
              <Badge variant="tipo" value={item.tipo} />
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Status</span>
              <Dropdown label={item.status.replace('_', ' ')}>
                <div className="p-1 min-w-[140px]">
                  {STATUS_DISPONIVEIS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        handleStatusChange(opt.value)
                        setOpen(false)
                      }}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded transition-colors ${
                        opt.value === item.status
                          ? 'text-[var(--d1)] bg-[var(--d1)]/10'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      {opt.value === item.status && <Check size={14} className="text-[var(--d1)]" />}
                      <span className={opt.value === item.status ? '' : 'ml-6'}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </Dropdown>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Data</span>
              <span className="text-[var(--text-primary)]">{item.dataDisparo}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Horário</span>
              <span className="text-[var(--text-primary)]">{item.horarioDisparo}</span>
            </div>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block text-xs mb-1">Casas de Aposta</span>
            <div className="flex flex-wrap gap-1">
              {item.casasAposta.map((casaId) => {
                const casa = casas[casaId]
                if (!casa) return null
                return <Chip key={casaId} label={casa.nome} cor={casa.cor} size="md" />
              })}
            </div>
          </div>

          {item.disparoLocal && (
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Base CSV</span>
              <span className="text-[var(--text-primary)]">{item.disparoLocal.base.status}</span>
              {item.disparoLocal.base.nomeArquivo && (
                <span className="text-[var(--text-secondary)] ml-2">({item.disparoLocal.base.nomeArquivo})</span>
              )}
            </div>
          )}

          {item.disparoLocal && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">UTM (Superbet)</span>
                <Dropdown label={item.disparoLocal.utm || 'Nenhum'}>
                  <div className="p-1 min-w-[200px] max-h-[240px] overflow-y-auto">
                    {item.disparoLocal.utm && (
                      <button
                        onClick={() => update(item.disparoLocal!.id, { utm: undefined })}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        Remover
                      </button>
                    )}
                    {utmConfigs.filter((u) => u.casa === 'superbet').map((u) => (
                      <button
                        key={u.id}
                        onClick={() => update(item.disparoLocal!.id, { utm: u.valor })}
                        className="flex items-center justify-between gap-2 w-full px-2 py-1.5 text-sm rounded text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <span>{u.nome}</span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[90px]">{u.valor}</span>
                      </button>
                    ))}
                    {utmConfigs.filter((u) => u.casa === 'superbet').length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-[var(--text-muted)]">Nenhum UTM cadastrado em /utms</p>
                    )}
                  </div>
                </Dropdown>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">PID (BetMGM)</span>
                <Dropdown label={item.disparoLocal.betmgmPid || 'Nenhum'}>
                  <div className="p-1 min-w-[200px] max-h-[240px] overflow-y-auto">
                    {item.disparoLocal.betmgmPid && (
                      <button
                        onClick={() => update(item.disparoLocal!.id, { betmgmPid: undefined })}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        Remover
                      </button>
                    )}
                    {utmConfigs.filter((u) => u.casa === 'betmgm').map((u) => (
                      <button
                        key={u.id}
                        onClick={() => update(item.disparoLocal!.id, { betmgmPid: u.valor })}
                        className="flex items-center justify-between gap-2 w-full px-2 py-1.5 text-sm rounded text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <span>{u.nome}</span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[90px]">{u.valor}</span>
                      </button>
                    ))}
                    {utmConfigs.filter((u) => u.casa === 'betmgm').length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-[var(--text-muted)]">Nenhum PID cadastrado em /utms</p>
                    )}
                  </div>
                </Dropdown>
              </div>
            </div>
          )}

          {item.entregues != null && (
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Métricas DAXX</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{formatNumero(item.entregues)}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Enviados</div>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.lidas != null ? formatNumero(item.lidas) : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Lidos</div>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.rejeitados != null ? formatNumero(item.rejeitados) : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Rejeitados</div>
                </div>
              </div>
            </div>
          )}

          {item.disparoLocal?.notas && (
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Notas</span>
              <p className="text-[var(--text-primary)]">{item.disparoLocal.notas}</p>
            </div>
          )}

          {esteira && item.tipo === 'D1' && (
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Esteira</span>
              <Link href="/esteiras" className="text-[var(--d1)] text-xs hover:underline">
                Ver esteira completa
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-[var(--border)]">
          {item.status !== 'executado' && item.status !== 'cancelado' && (
            <Button variant="primary" size="sm" icon={<Play size={14} />} onClick={handleExecutar}>
              Executar
            </Button>
          )}
          {item.disparoLocal && (
            <Link href={`/disparos/${item.disparoLocal.id}`}>
              <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                Detalhes
              </Button>
            </Link>
          )}
          {item.disparoLocal && (
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleDelete}>
              Excluir
            </Button>
          )}
        </div>
      </Modal>
    </>
  )
}
