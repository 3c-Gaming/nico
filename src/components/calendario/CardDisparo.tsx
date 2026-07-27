'use client'

import { useState, useEffect } from 'react'
import type { ItemCalendario, StatusDisparo, Disparo } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useEsteiras } from '@/hooks/useEsteiras'
import { parsearNomeCampanhaDaxx, casaPadraoPorTipo } from '@/lib/daxx-parser'
import { useUtmConfigs } from '@/hooks/useUtmConfigs'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { StatusDot } from '../ui/StatusDot'
import { Modal } from '../ui/Modal'
import { Dropdown } from '../ui/Dropdown'
import { TagInput } from '../ui/TagInput'
import { useToast } from '../ui/Toast'
import { ExternalLink, Trash2, Play, Check, Clock, Database } from 'lucide-react'
import Link from 'next/link'

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

const CUSTO_POR_ENTREGUE = 0.13

function formatMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Corta o prefixo padrão da DAXX ("[dd/mm] DISP TOTAL dd/mm BASE ") e deixa só o rótulo da base. */
function nomeCurto(nome: string): string {
  const cortado = nome.replace(/^\[\d{2}\/\d{2}\]\s*DISP\s+TOTAL\s+\d{2}\/\d{2}\s+BASE\s+/i, '').trim()
  return cortado || nome
}

export function CardItemCalendario({ item }: CardItemCalendarioProps) {
  const [open, setOpen] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [casasSelecionadas, setCasasSelecionadas] = useState<string[]>([])
  const [utmEscolhida, setUtmEscolhida] = useState('')
  const [pidEscolhido, setPidEscolhido] = useState('')
  const { update, remove, create } = useDisparos()
  const { getById, create: createEsteira } = useEsteiras()
  const { casas, list: casasList, add: addCasa } = useCasasAposta()
  const { list: utmConfigs } = useUtmConfigs()
  const { addToast } = useToast()

  const cor = TIPO_CORES[item.tipo] ?? 'var(--text-secondary)'
  const esteira = item.disparoLocal?.esteiraPaiId ? getById(item.disparoLocal.esteiraPaiId) : null

  useEffect(() => {
    if (open && item.fonte === 'daxx' && item.campanhaDaxx) {
      setCasasSelecionadas(casaPadraoPorTipo(item.tipo, casasList))
      setUtmEscolhida('')
      setPidEscolhido('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  async function handleCadastrar() {
    const campanha = item.campanhaDaxx
    if (!campanha || !item.tipo || cadastrando) return
    setCadastrando(true)

    try {
      const now = new Date().toISOString()
      const parsed = parsearNomeCampanhaDaxx(campanha.nome)
      const utmSel = utmConfigs.find((u) => u.valor === utmEscolhida)
      const pidSel = utmConfigs.find((u) => u.valor === pidEscolhido)

      const disparoData: Disparo = {
        id: crypto.randomUUID(),
        tipo: item.tipo,
        nomenclatura: campanha.nome,
        status: 'rascunho',
        casasAposta: casasSelecionadas,
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
        daxxCampanhaId: campanha.id,
        utm: utmSel?.valor,
        betmgmPid: pidSel?.valor,
        criadoEm: now,
        atualizadoEm: now,
        valorTotalBase: campanha.totalBase,
        conversao: {
          entreguesDaxx: campanha.entregues,
          leadsFluxo: 0,
          atualizadoEm: now,
        },
      }

      const cicloChave = item.tipo !== 'PONTUAL' ? parsed.esteiraKey : null

      const res = await fetch('/api/disparos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disparo: disparoData, cicloChave }),
      })

      if (res.status === 409) {
        addToast('error', 'Essa campanha da DAXX já foi cadastrada')
        setOpen(false)
        return
      }
      if (!res.ok) {
        addToast('error', 'Erro ao cadastrar disparo — tente novamente')
        return
      }

      const resultado = await res.json()
      create(resultado.disparo)
      if (resultado.esteira) createEsteira(resultado.esteira)

      addToast('success', `${item.tipo} cadastrado a partir da DAXX`)
      setOpen(false)
    } catch {
      addToast('error', 'Erro de rede ao cadastrar disparo')
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
          <p className="font-mono text-[11px] text-[var(--text-secondary)] truncate mb-1" title={item.nome}>
            {nomeCurto(item.nome)}
          </p>
          {item.entregues != null && (
            <div className="text-base font-semibold text-[var(--text-primary)] leading-none mb-1">
              {formatMoeda(item.entregues * CUSTO_POR_ENTREGUE)}
            </div>
          )}
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

            <div className="pt-2 border-t border-[var(--border)] space-y-3">
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">Casas de Aposta (confirme antes de cadastrar)</span>
                <TagInput
                  tags={casasSelecionadas}
                  casasDisponiveis={casasList.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor }))}
                  onAdd={(nome) => {
                    const casa = addCasa(nome)
                    setCasasSelecionadas((prev) => prev.includes(casa.id) ? prev : [...prev, casa.id])
                    return { id: casa.id, nome: casa.nome, cor: casa.cor }
                  }}
                  onRemove={(id) => setCasasSelecionadas((prev) => prev.filter((c) => c !== id))}
                  placeholder="Digite o nome da casa..."
                />
              </div>

              {casasSelecionadas.some((id) => /super/i.test(casasList.find((c) => c.id === id)?.slug ?? '')) && (
                <div>
                  <span className="text-[var(--text-muted)] block text-xs mb-1">UTM (Superbet)</span>
                  <Dropdown label={utmConfigs.find((u) => u.valor === utmEscolhida)?.nome ?? 'Nenhum'}>
                    <div className="p-1 min-w-[200px] max-h-[240px] overflow-y-auto">
                      {utmEscolhida && (
                        <button
                          onClick={() => setUtmEscolhida('')}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          Remover
                        </button>
                      )}
                      {utmConfigs.filter((u) => u.casa === 'superbet').map((u) => (
                        <button
                          key={u.id}
                          onClick={() => setUtmEscolhida(u.valor)}
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
              )}

              {casasSelecionadas.some((id) => /mgm/i.test(casasList.find((c) => c.id === id)?.slug ?? '')) && (
                <div>
                  <span className="text-[var(--text-muted)] block text-xs mb-1">PID (BetMGM)</span>
                  <Dropdown label={utmConfigs.find((u) => u.valor === pidEscolhido)?.nome ?? 'Nenhum'}>
                    <div className="p-1 min-w-[200px] max-h-[240px] overflow-y-auto">
                      {pidEscolhido && (
                        <button
                          onClick={() => setPidEscolhido('')}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          Remover
                        </button>
                      )}
                      {utmConfigs.filter((u) => u.casa === 'betmgm').map((u) => (
                        <button
                          key={u.id}
                          onClick={() => setPidEscolhido(u.valor)}
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
              )}
            </div>
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

        <p className="font-mono text-[11px] text-[var(--text-secondary)] truncate mb-1">
          {nomeCurto(item.nomenclatura)}
        </p>

        {item.entregues != null && (
          <div className="text-base font-semibold text-[var(--text-primary)] leading-none mb-1">
            {formatMoeda(item.entregues * CUSTO_POR_ENTREGUE)}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span>{item.horarioDisparo}</span>
          <span>·</span>
          {item.totalBase != null && (
            <>
              <span>{formatNumero(item.totalBase)} base</span>
              <span>·</span>
            </>
          )}
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
