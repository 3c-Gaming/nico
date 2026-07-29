'use client'

import { useState, useEffect } from 'react'
import type { ItemCalendario, StatusDisparo, Disparo, NumeroSendpulse, FluxoSendpulse } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useEsteiras } from '@/hooks/useEsteiras'
import { parsearNomeCampanhaDaxx, casaPadraoPorTipo } from '@/lib/daxx-parser'
import { useUtmConfigs } from '@/hooks/useUtmConfigs'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Dropdown } from '../ui/Dropdown'
import { TagInput } from '../ui/TagInput'
import { useToast } from '../ui/Toast'
import { StatNumber } from '../ui/StatNumber'
import { useResultadoDisparo } from '@/hooks/useResultadoDisparo'
import { usePinnedDisparos } from '@/hooks/usePinnedDisparos'
import { formatNumero, CUSTO_POR_ENTREGUE, nomeCurto } from '@/lib/resultadoDisparo'
import { StepNumero } from '../disparos/StepNumero'
import { getState } from '@/lib/store'
import { ExternalLink, Trash2, Check, Clock, Database, Pin, ChevronDown, ChevronUp } from 'lucide-react'
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

export interface ResultadoContribuicaoDia {
  registros: number
  ftds: number
  cpas: number | null
  custo: number
  receita: number
}

interface CardItemCalendarioProps {
  item: ItemCalendario
  onResultado?: (id: string, r: ResultadoContribuicaoDia | null) => void
}

interface BlocoResultadoFinanceiroProps {
  carregando: boolean
  resultado: { registros: number; ftds: number; cpas: number | null } | null
  custo: number
  receita: number
  roi: number | null
}

function BlocoResultadoFinanceiro({ carregando, resultado, custo, receita, roi }: BlocoResultadoFinanceiroProps) {
  if (carregando) return <p className="text-xs text-[var(--text-muted)]">Carregando...</p>
  if (!resultado) return <p className="text-xs text-[var(--text-muted)]">Sem dados de resultado pra essa UTM/data ainda</p>

  const temCpa = resultado.cpas != null

  return (
    <>
      <div className={`grid ${temCpa ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
        <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
          <div className="text-lg font-semibold text-[var(--text-primary)]"><StatNumber value={resultado.registros} /></div>
          <div className="text-[10px] text-[var(--text-muted)]">Registros</div>
        </div>
        <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
          <div className="text-lg font-semibold text-[var(--text-primary)]"><StatNumber value={resultado.ftds} /></div>
          <div className="text-[10px] text-[var(--text-muted)]">FTDs</div>
        </div>
        {temCpa && (
          <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
            <div className="text-lg font-semibold text-[var(--text-primary)]"><StatNumber value={resultado.cpas!} /></div>
            <div className="text-[10px] text-[var(--text-muted)]">CPAs</div>
          </div>
        )}
      </div>
      {!temCpa ? (
        <p className="text-[10px] text-[var(--text-muted)] mt-1">CPA e ROI só ficam disponíveis depois que o dia fecha — a fonte de CPA não cobre o dia de hoje ainda</p>
      ) : roi != null ? (
        <div className="flex items-center justify-between mt-2 p-2 rounded bg-[var(--bg-surface)]">
          <span className="text-[10px] text-[var(--text-muted)]">
            Receita <StatNumber value={receita} prefix="R$ " decimals={2} /> · Custo <StatNumber value={custo} prefix="R$ " decimals={2} />
          </span>
          <span className={`text-sm font-semibold ${roi >= 1 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
            ROI <StatNumber value={roi} suffix="x" decimals={Number.isInteger(roi) ? 0 : 1} />
          </span>
        </div>
      ) : (
        <p className="text-[10px] text-[var(--text-muted)] mt-1">ROI indisponível — sem custo/casa suficiente pra calcular</p>
      )}
    </>
  )
}

export function CardItemCalendario({ item, onResultado }: CardItemCalendarioProps) {
  const [open, setOpen] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [casasSelecionadas, setCasasSelecionadas] = useState<string[]>([])
  const [utmEscolhida, setUtmEscolhida] = useState('')
  const [pidEscolhido, setPidEscolhido] = useState('')
  const [numerosSendpulse, setNumerosSendpulseState] = useState<NumeroSendpulse[]>(item.disparoLocal?.numerosSendpulse ?? [])
  const [flowIds, setFlowIdsState] = useState<string[]>(item.disparoLocal?.flowIds ?? (item.disparoLocal?.flowId ? [item.disparoLocal.flowId] : []))
  const [fluxosDisponiveis, setFluxosDisponiveis] = useState<FluxoSendpulse[]>([])
  const [carregandoFluxos, setCarregandoFluxos] = useState(false)
  const [mostrarFluxoPicker, setMostrarFluxoPicker] = useState(() => (item.disparoLocal?.numerosSendpulse?.length ?? 0) > 0)
  const { update, remove, create } = useDisparos()
  const { getById, create: createEsteira } = useEsteiras()
  const { casas, list: casasList, add: addCasa } = useCasasAposta()
  const { list: utmConfigs } = useUtmConfigs()
  const { addToast } = useToast()
  const { isPinned, toggle: togglePin } = usePinnedDisparos()

  const cor = TIPO_CORES[item.tipo] ?? 'var(--text-secondary)'
  const esteira = item.disparoLocal?.esteiraPaiId ? getById(item.disparoLocal.esteiraPaiId) : null

  const disparoLocal = item.disparoLocal
  const utmDoDisparo = disparoLocal?.utm
  const pidDoDisparo = disparoLocal?.betmgmPid
  const dataDoDisparo = disparoLocal?.dataDisparo

  // No disparo já cadastrado, usa a UTM/PID salva. No cadastro (ainda não salvo),
  // usa o que está selecionado nos dropdowns em tempo real — só busca enquanto o modal
  // estiver aberto, pra não disparar fetch de preview pra todo card DAXX ainda não vinculado.
  const utmValorAtivo = disparoLocal ? (utmDoDisparo || pidDoDisparo) : (utmEscolhida || pidEscolhido)
  const casaAtiva: 'superbet' | 'betmgm' | null = disparoLocal
    ? (utmDoDisparo ? 'superbet' : pidDoDisparo ? 'betmgm' : null)
    : (utmEscolhida ? 'superbet' : pidEscolhido ? 'betmgm' : null)
  const dataAtiva = disparoLocal ? dataDoDisparo : item.dataDisparo
  const ativo = !!disparoLocal || open

  const { resultado: resultadoFinanceiro, carregando: carregandoResultado, custo, receita, roi } = useResultadoDisparo({
    utmValor: ativo ? utmValorAtivo : undefined,
    casa: ativo ? casaAtiva : null,
    data: ativo ? dataAtiva : undefined,
    entregues: item.entregues,
  })

  // Reporta a contribuição deste disparo pro resumo do dia (só disparos já cadastrados
  // contam — sem cadastro não existe UTM/PID salva pra saber qual resultado é de fato dele).
  useEffect(() => {
    if (!onResultado) return
    if (!disparoLocal || !resultadoFinanceiro) { onResultado(item.id, null); return }
    onResultado(item.id, { registros: resultadoFinanceiro.registros, ftds: resultadoFinanceiro.ftds, cpas: resultadoFinanceiro.cpas, custo, receita })
  }, [onResultado, item.id, disparoLocal, resultadoFinanceiro, custo, receita])

  useEffect(() => {
    if (open && item.fonte === 'daxx' && item.campanhaDaxx) {
      setCasasSelecionadas(casaPadraoPorTipo(item.tipo, casasList))
      setUtmEscolhida('')
      setPidEscolhido('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const botIdsSendpulseKey = [...new Set(numerosSendpulse.map((n) => n.id))].join(',')

  // Busca os fluxos dos números escolhidos, pra poder marcar quais têm a tag que a gente
  // quer acompanhar (mesma tag configurada em /funis pra esse fluxo).
  useEffect(() => {
    const botIds = botIdsSendpulseKey ? botIdsSendpulseKey.split(',') : []
    if (!botIds.length) { setFluxosDisponiveis([]); return }
    let cancelado = false
    setCarregandoFluxos(true)
    Promise.all(
      botIds.map((botId) =>
        fetch(`/api/sendpulse/fluxos?bot_id=${encodeURIComponent(botId)}`)
          .then((r) => (r.ok ? r.json() : { fluxos: [] }))
          .catch(() => ({ fluxos: [] })),
      ),
    )
      .then((resultados) => { if (!cancelado) setFluxosDisponiveis(resultados.flatMap((r) => r.fluxos ?? [])) })
      .finally(() => { if (!cancelado) setCarregandoFluxos(false) })
    return () => { cancelado = true }
  }, [botIdsSendpulseKey])

  function handleNumerosSendpulseChange(nums: NumeroSendpulse[]) {
    setNumerosSendpulseState(nums)
    if (disparoLocal) update(disparoLocal.id, { numerosSendpulse: nums })
  }

  function toggleFlow(flowId: string) {
    const proximo = flowIds.includes(flowId) ? flowIds.filter((id) => id !== flowId) : [...flowIds, flowId]
    setFlowIdsState(proximo)
    if (disparoLocal) update(disparoLocal.id, { flowIds: proximo })
  }

  function handleStatusChange(status: StatusDisparo) {
    if (!item.disparoLocal) return
    update(item.disparoLocal.id, { status })
    addToast('success', `Status alterado para ${status.replace('_', ' ')}`)
  }

  function handleDelete() {
    if (!item.disparoLocal) return
    if (confirm('Tem certeza que deseja apagar este disparo?')) {
      remove(item.disparoLocal.id)
      addToast('success', 'Disparo removido')
      setOpen(false)
    }
  }

  async function handleCadastrar(overrides?: { utm?: string; pid?: string }) {
    const campanha = item.campanhaDaxx
    if (!campanha || !item.tipo || cadastrando) return
    setCadastrando(true)

    try {
      const now = new Date().toISOString()
      const parsed = parsearNomeCampanhaDaxx(campanha.nome)
      const utmSel = utmConfigs.find((u) => u.valor === (overrides?.utm ?? utmEscolhida))
      const pidSel = utmConfigs.find((u) => u.valor === (overrides?.pid ?? pidEscolhido))

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

  if (item.fonte === 'projetado') {
    return (
      <div
        className="w-full text-left rounded p-2.5 opacity-60"
        style={{
          backgroundColor: 'transparent',
          border: '1px dashed var(--border)',
          borderLeft: `3px dashed ${cor}`,
        }}
        title="Projeção — some quando a campanha real aparecer na DAXX"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold" style={{ color: cor }}>{item.tipo}</span>
          <span className="ml-auto text-[10px] font-medium text-[var(--text-muted)]">projetado</span>
        </div>
        <p className="font-mono text-[11px] text-[var(--text-muted)] truncate">
          {item.nome}
        </p>
      </div>
    )
  }

  if (item.fonte === 'daxx') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left rounded p-2.5 cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px dashed var(--border-strong)',
            borderLeft: `3px solid ${cor}`,
          }}
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
              <StatNumber value={item.entregues * CUSTO_POR_ENTREGUE} prefix="R$ " decimals={2} />
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
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.entregues != null ? <StatNumber value={item.entregues} /> : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Enviados</div>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.lidas != null ? <StatNumber value={item.lidas} /> : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Lidos</div>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.rejeitados != null ? <StatNumber value={item.rejeitados} /> : '—'}</div>
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
                <span className="text-[var(--text-muted)] block text-xs mb-1">Casas de Aposta (confirme antes de escolher a UTM/PID — escolher já cadastra e vincula)</span>
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

              {casasSelecionadas.some((id) => /super/i.test(casasList.find((c) => c.id === id)?.nome ?? '')) && (
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
                          onClick={() => { setUtmEscolhida(u.valor); handleCadastrar({ utm: u.valor }) }}
                          disabled={cadastrando}
                          className="flex items-center justify-between gap-2 w-full px-2 py-1.5 text-sm rounded text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50"
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

              {casasSelecionadas.some((id) => /mgm/i.test(casasList.find((c) => c.id === id)?.nome ?? '')) && (
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
                          onClick={() => { setPidEscolhido(u.valor); handleCadastrar({ pid: u.valor }) }}
                          disabled={cadastrando}
                          className="flex items-center justify-between gap-2 w-full px-2 py-1.5 text-sm rounded text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50"
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

              {(utmEscolhida || pidEscolhido) && (
                <div>
                  <span className="text-[var(--text-muted)] block text-xs mb-1">Resultado (via UTM)</span>
                  <BlocoResultadoFinanceiro carregando={carregandoResultado} resultado={resultadoFinanceiro} custo={custo} receita={receita} roi={roi} />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-[var(--border)]">
            <Button
              variant="primary"
              size="sm"
              icon={<Check size={14} />}
              onClick={() => handleCadastrar()}
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
          className="w-full text-left rounded p-2.5 cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--info)',
            borderLeft: '3px solid var(--info)',
          }}
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        className="w-full text-left rounded p-2.5 cursor-pointer"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${cor}`,
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold" style={{ color: cor }}>
            {item.tipo}
          </span>
          {disparoLocal && (
            <button
              onClick={(e) => { e.stopPropagation(); togglePin(disparoLocal.id) }}
              className="ml-auto flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--bg-elevated)] transition-colors"
              title={isPinned(disparoLocal.id) ? 'Desafixar da Home' : 'Fixar na Home'}
            >
              <Pin size={12} className={isPinned(disparoLocal.id) ? 'text-amber-400' : 'text-[var(--text-muted)]/40'} />
            </button>
          )}
        </div>

        <p className="font-mono text-[11px] text-[var(--text-secondary)] truncate mb-1">
          {nomeCurto(item.nomenclatura)}
        </p>

        {item.entregues != null && (
          <div className="text-base font-semibold text-[var(--text-primary)] leading-none mb-1">
            <StatNumber value={item.entregues * CUSTO_POR_ENTREGUE} prefix="R$ " decimals={2} />
          </div>
        )}

        {resultadoFinanceiro && (
          <div className="grid grid-cols-4 items-center text-sm text-text-primary my-2">
            <span className="font-semibold"><StatNumber value={resultadoFinanceiro.registros} /> REG</span>
            <span className="font-semibold"><StatNumber value={resultadoFinanceiro.ftds} /> FTD</span>
            {resultadoFinanceiro.cpas != null && (
              <span className="font-semibold"><StatNumber value={resultadoFinanceiro.cpas} /> CPA</span>
            )}
            {roi != null && (
              <span className={`font-semibold ${roi >= 1 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                <StatNumber value={roi} suffix="x" decimals={Number.isInteger(roi) ? 0 : 1} />
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[12px] text-text-primary">
          <span>{item.horarioDisparo}</span>
          <span>·</span>
          {item.totalBase != null && (
            <>
              <span>Base {formatNumero(item.totalBase)}</span>
              <span>·</span>
            </>
          )}
          {item.entregues != null && (
            <>
              <span className="">{formatNumero(item.entregues)} Entregues.</span>
            </>
          )}
        </div>
      </div>

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
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded transition-colors ${opt.value === item.status
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
            <div className="grid grid-cols-1 gap-4 w-full">
              <div>
                <span className="text-[var(--text-muted)] block text-xs mb-1">UTM (Superbet)</span>
                <Dropdown label={item.disparoLocal.utm || 'Nenhum'}>
                  <div className="p-1 w-full overflow-y-auto">
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
                  <div className="text-lg font-semibold text-[var(--text-primary)]"><StatNumber value={item.entregues} /></div>
                  <div className="text-[10px] text-[var(--text-muted)]">Enviados</div>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.lidas != null ? <StatNumber value={item.lidas} /> : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Lidos</div>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-surface)]">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{item.rejeitados != null ? <StatNumber value={item.rejeitados} /> : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Rejeitados</div>
                </div>
              </div>
            </div>
          )}

          {(utmDoDisparo || pidDoDisparo) && (
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Resultado (via UTM)</span>
              <BlocoResultadoFinanceiro carregando={carregandoResultado} resultado={resultadoFinanceiro} custo={custo} receita={receita} roi={roi} />
            </div>
          )}

          {disparoLocal && (
            <div>
              <button
                onClick={() => setMostrarFluxoPicker((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-1"
              >
                {mostrarFluxoPicker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Fluxo / Leads hoje {flowIds.length > 0 && <span className="text-[var(--d1)]">({flowIds.length} vinculado{flowIds.length > 1 ? 's' : ''})</span>}
              </button>
              {mostrarFluxoPicker && (
                <div className="space-y-3 p-3 rounded bg-[var(--bg-surface)] border border-[var(--border)]">
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Vincule o número e o fluxo da SendPulse desse disparo pra ver os Leads hoje (mesma tag configurada em /funis pra esse fluxo).
                  </p>
                  <StepNumero numeros={numerosSendpulse} onChange={handleNumerosSendpulseChange} />
                  {numerosSendpulse.length > 0 && (
                    <div>
                      <span className="text-[var(--text-muted)] block text-xs mb-1">Fluxos</span>
                      {carregandoFluxos ? (
                        <span className="text-[10px] text-[var(--text-muted)]">carregando fluxos...</span>
                      ) : fluxosDisponiveis.length === 0 ? (
                        <p className="text-[10px] text-[var(--text-muted)]">Nenhum fluxo encontrado pra esse(s) número(s)</p>
                      ) : (
                        <div className="space-y-2">
                          {numerosSendpulse.map((num) => {
                            const flowsDoNumero = fluxosDisponiveis.filter((f) => f.botId === num.id)
                            if (!flowsDoNumero.length) return null
                            return (
                              <div key={num.id}>
                                <span className="text-[10px] text-[var(--text-secondary)] font-mono">{num.numero}</span>
                                <div className="space-y-0.5 mt-0.5">
                                  {flowsDoNumero.map((flow) => {
                                    const cfg = getState().flowTagConfigs[flow.id]
                                    const selected = flowIds.includes(flow.id)
                                    return (
                                      <label
                                        key={flow.id}
                                        className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-[var(--bg-elevated)] text-xs"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={() => toggleFlow(flow.id)}
                                          className="accent-[var(--d1)]"
                                        />
                                        <span className="text-[var(--text-primary)]">{flow.nome}</span>
                                        {cfg?.funil && <span className="text-[var(--text-muted)]">({cfg.funil})</span>}
                                        {(cfg?.tags?.length ?? 0) > 0 && (
                                          <span className="text-[10px] text-[var(--text-muted)] font-mono truncate">{cfg!.tags.join(', ')}</span>
                                        )}
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
