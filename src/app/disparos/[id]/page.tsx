'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useEsteiras } from '@/hooks/useEsteiras'
import { useLinkTemplates, renderLinkTemplate } from '@/hooks/useLinkTemplates'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Dropdown } from '@/components/ui/Dropdown'
import { useToast } from '@/components/ui/Toast'
import { criarEsteira } from '@/lib/esteira'
import { getState } from '@/lib/store'
import { ArrowLeft, Trash2, Pencil, X, Check, Copy, Link as LinkIcon, Play, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { StepNumero } from '@/components/disparos/StepNumero'
import { sincronizarDisparos } from '@/lib/tracking/sync'
import type { StatusDisparo, StatusBase, TipoDisparo, NumeroSendpulse, PainelCPA, ResultadoDisparo, ConversaoDisparo, FluxoSendpulse, TrackingResultado } from '@/types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'pronto', label: 'Pronto' },
  { value: 'em_validacao', label: 'Em Validação' },
  { value: 'executado', label: 'Executado' },
  { value: 'cancelado', label: 'Cancelado' },
]

const BASE_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'baixando', label: 'Baixando' },
  { value: 'disponivel', label: 'Disponível' },
  { value: 'erro', label: 'Erro' },
]

const PROXIMO_TIPO: Record<string, TipoDisparo> = {
  D1: 'D3',
  D3: 'D5',
  D5: 'D7',
}

export default function DetalheDisparoPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { getById, update, remove, create: createDisparo } = useDisparos()
  const { casas, list: casasList } = useCasasAposta()
  const { getByCasaAndTipo } = useLinkTemplates()
  const { getById: getEsteira, update: updateEsteira, create: createEsteiraStore } = useEsteiras()
  const { addToast } = useToast()

  const [modoEdicao, setModoEdicao] = useState(false)
  const [executando, setExecutando] = useState(false)
  const [avancando, setAvancando] = useState(false)
  const [editandoResultados, setEditandoResultados] = useState(false)
  const [resForm, setResForm] = useState<Partial<ResultadoDisparo> & { valorTotalBase?: number }>({})
  const [carregandoLeads, setCarregandoLeads] = useState(false)
  const [fluxosDisponiveis, setFluxosDisponiveis] = useState<FluxoSendpulse[]>([])
  const [carregandoFluxos, setCarregandoFluxos] = useState(false)
  const [sincronizandoTracking, setSincronizandoTracking] = useState(false)

  const disparo = getById(id)

  const selecionados = disparo?.linkTemplatesSelecionados ?? []
  const isSelected = (linkId: string) => selecionados.includes(linkId)
  function toggleLink(linkId: string) {
    if (!disparo) return
    update(disparo.id, {
      linkTemplatesSelecionados: isSelected(linkId)
        ? selecionados.filter((id) => id !== linkId)
        : [...selecionados, linkId],
    })
  }

  const [formData, setFormData] = useState({
    status: disparo?.status ?? 'rascunho' as StatusDisparo,
    dataDisparo: disparo?.dataDisparo ?? '',
    horarioDisparo: disparo?.horarioDisparo ?? '',
    baseStatus: (disparo?.base.status ?? 'pendente') as StatusBase,
    casasAposta: [...(disparo?.casasAposta ?? [])],
    notas: disparo?.notas ?? '',
    numerosSendpulse: [...(disparo?.numerosSendpulse ?? [])] as NumeroSendpulse[],
    utm: disparo?.utm ?? '',
    betmgmPid: disparo?.betmgmPid ?? '',
    cpaPainelId: disparo?.cpaPainelId ?? '',
    flowIds: [...(disparo?.flowIds ?? (disparo?.flowId ? [disparo.flowId] : []))],
    entreguesDaxx: disparo?.conversao?.entreguesDaxx ?? 0,
    leadsFluxo: disparo?.conversao?.leadsFluxo ?? 0,
  })

  useEffect(() => {
    if (!formData.numerosSendpulse.length) { setFluxosDisponiveis([]); return }
    setCarregandoFluxos(true)
    const botIds = [...new Set(formData.numerosSendpulse.map((n) => n.id))]
    Promise.all(
      botIds.map((botId) =>
        fetch(`/api/sendpulse/fluxos?bot_id=${encodeURIComponent(botId)}`)
          .then((r) => r.ok ? r.json() : { fluxos: [] })
          .then((d) => d.fluxos as FluxoSendpulse[])
          .catch(() => [] as FluxoSendpulse[])
      )
    ).then((results) => {
      setFluxosDisponiveis(results.flat())
    }).finally(() => setCarregandoFluxos(false))
  }, [formData.numerosSendpulse])

  useEffect(() => {
    const flowIds = disparo?.flowIds ?? (disparo?.flowId ? [disparo.flowId] : [])
    if (!disparo?.numerosSendpulse?.length || !disparo.dataDisparo || !flowIds.length) return
    const configs = getState().flowTagConfigs
    const tags = [...new Set(flowIds.flatMap((fid) => configs[fid]?.tags ?? []))]
    if (!tags.length) return
    setCarregandoLeads(true)
    fetch('/api/leadhub/contagem-por-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, data: disparo.dataDisparo }),
    })
      .then((res) => res.json())
      .then((json) => {
        const total = Object.values(json.leads as Record<string, number>).reduce((s, v) => s + v, 0)
        if (total !== disparo.conversao?.leadsFluxo) {
          update(id, {
            conversao: {
              entreguesDaxx: disparo.conversao?.entreguesDaxx ?? 0,
              leadsFluxo: total,
              atualizadoEm: new Date().toISOString(),
            },
          })
        }
      })
      .catch(() => {})
      .finally(() => setCarregandoLeads(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, JSON.stringify(disparo?.flowIds ?? [disparo?.flowId])])

  useEffect(() => {
    if (!modoEdicao || !formData.dataDisparo || !formData.flowIds.length) return
    const configs = getState().flowTagConfigs
    const tags = [...new Set(formData.flowIds.flatMap((fid) => configs[fid]?.tags ?? []))]
    if (!tags.length) return
    setCarregandoLeads(true)
    const timer = setTimeout(() => {
      fetch('/api/leadhub/contagem-por-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags, data: formData.dataDisparo }),
      })
        .then((res) => res.json())
        .then((json) => {
          const total = Object.values(json.leads as Record<string, number>).reduce((s, v) => s + v, 0)
          setFormData((prev) => ({ ...prev, leadsFluxo: total }))
        })
        .catch(() => {})
        .finally(() => setCarregandoLeads(false))
    }, 800)
    return () => { clearTimeout(timer); setCarregandoLeads(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoEdicao, JSON.stringify(formData.flowIds), formData.dataDisparo])

  // Backfill totalRegistros para disparos antigos que têm driveFileId mas não têm contagem
  useEffect(() => {
    if (!disparo?.base.driveFileId || disparo.base.totalRegistros != null) return
    fetch(`/api/drive/contar-linhas?fileId=${disparo.base.driveFileId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json && typeof json.totalLinhas === 'number') {
          update(id, { base: { ...disparo.base, totalRegistros: json.totalLinhas } })
          addToast('success', `Custo da base calculado: ${(json.totalLinhas * 0.13).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
        }
      })
      .catch(() => {})
  }, [id, disparo?.base.driveFileId, disparo?.base.totalRegistros])

  const esteira = disparo?.esteiraPaiId ? getEsteira(disparo.esteiraPaiId) : null
  const tipoAtual = disparo?.tipo ?? ''
  const podeAvancar = tipoAtual in PROXIMO_TIPO && disparo?.status === 'executado'
  const proximoTipo = PROXIMO_TIPO[tipoAtual]
  const filhoExistente = proximoTipo && esteira ? esteira.disparos[proximoTipo.toLowerCase() as 'd3' | 'd5' | 'd7'] : null

  if (!disparo) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <p className="text-[var(--text-secondary)]">Disparo não encontrado</p>
        <Link href="/disparos">
          <Button variant="secondary">Voltar para lista</Button>
        </Link>
      </div>
    )
  }

  function handleDelete() {
    if (confirm('Tem certeza que deseja apagar este disparo?')) {
      remove(id)
      addToast('success', 'Disparo removido')
      router.push('/disparos')
    }
  }

  function toggleEdicao() {
    if (!modoEdicao) {
      setFormData({
        status: disparo.status,
        dataDisparo: disparo.dataDisparo,
        horarioDisparo: disparo.horarioDisparo,
        baseStatus: disparo.base.status,
        casasAposta: [...disparo.casasAposta],
        notas: disparo.notas ?? '',
        numerosSendpulse: [...(disparo.numerosSendpulse ?? [])],
        utm: disparo.utm ?? '',
        betmgmPid: disparo.betmgmPid ?? '',
        cpaPainelId: disparo.cpaPainelId ?? '',
        flowIds: [...(disparo.flowIds ?? (disparo.flowId ? [disparo.flowId] : []))],
        entreguesDaxx: disparo.conversao?.entreguesDaxx ?? 0,
        leadsFluxo: disparo.conversao?.leadsFluxo ?? 0,
      })
    }
    setModoEdicao(!modoEdicao)
  }

  function handleSave() {
    const data: Partial<typeof disparo> = {
      status: formData.status,
      dataDisparo: formData.dataDisparo,
      horarioDisparo: formData.horarioDisparo,
      casasAposta: formData.casasAposta,
      notas: formData.notas || undefined,
      base: { ...disparo.base, status: formData.baseStatus },
      numerosSendpulse: formData.numerosSendpulse.length > 0 ? formData.numerosSendpulse : undefined,
      utm: formData.utm || undefined,
      betmgmPid: formData.betmgmPid || undefined,
      cpaPainelId: formData.cpaPainelId || undefined,
      flowIds: formData.flowIds.length > 0 ? formData.flowIds : undefined,
      conversao: {
        entreguesDaxx: formData.entreguesDaxx,
        leadsFluxo: formData.leadsFluxo,
        atualizadoEm: new Date().toISOString(),
      },
    }
    update(id, data)
    setModoEdicao(false)
    addToast('success', 'Disparo atualizado')
  }

  async function handleSyncTracking() {
    if (!disparo) return
    setSincronizandoTracking(true)
    try {
      const resultados = await sincronizarDisparos([disparo], disparo.dataDisparo)
      const r = resultados[disparo.id]
      if (r && (r.registros > 0 || r.ftds > 0)) {
        update(id, {
          resultados: {
            registros: r.registros,
            ftds: r.ftds,
            cpas: disparo.resultados?.cpas ?? 0,
            custo: disparo.resultados?.custo ?? 0,
            valorFaturadoCPA: disparo.resultados?.valorFaturadoCPA ?? 0,
            atualizadoEm: new Date().toISOString(),
          },
        })
        addToast('success', `Tracking sincronizado: ${r.registros} registros, ${r.ftds} FTDs`)
      } else {
        addToast('info', 'Nenhum dado de tracking encontrado para este disparo')
      }
    } catch {
      addToast('error', 'Erro ao sincronizar tracking')
    } finally {
      setSincronizandoTracking(false)
    }
  }

  function handleExecutar() {
    setExecutando(true)
    update(id, { status: 'executado' })
    addToast('success', `${disparo.tipo} executado com sucesso`)
    setExecutando(false)
  }

  function handleAvancarEsteira() {
    if (!podeAvancar || !proximoTipo || !esteira) return
    setAvancando(true)

    try {
      const agora = new Date()
      const dataD1 = new Date(disparo.dataDisparo + 'T12:00:00')
      const offset = proximoTipo === 'D3' ? 2 : proximoTipo === 'D5' ? 4 : 6
      const dataFilho = new Date(dataD1)
      dataFilho.setDate(dataFilho.getDate() + offset)
      const dataFilhoStr = dataFilho.toISOString().split('T')[0]

      const novoDisparo = {
        id: crypto.randomUUID(),
        tipo: proximoTipo,
        nomenclatura: disparo.nomenclatura.replace(`D1`, proximoTipo).replace(disparo.dataDisparo, dataFilhoStr),
        status: 'pronto' as StatusDisparo,
        casasAposta: [...disparo.casasAposta],
        dataDisparo: dataFilhoStr,
        horarioDisparo: disparo.horarioDisparo,
        base: { ...disparo.base },
        templateDaxx: disparo.templateDaxx ? { ...disparo.templateDaxx } : undefined,
        numerosSendpulse: disparo.numerosSendpulse?.map((n) => ({ ...n })),
        flowIds: [...(disparo.flowIds ?? (disparo.flowId ? [disparo.flowId] : []))],
        esteiraPaiId: esteira.id,
        criadoEm: agora.toISOString(),
        atualizadoEm: agora.toISOString(),
      }

      createDisparo(novoDisparo)

      const chave = proximoTipo.toLowerCase() as 'd3' | 'd5' | 'd7'
      updateEsteira(esteira.id, {
        disparos: { ...esteira.disparos, [chave]: novoDisparo.id },
      })

      addToast('success', `${proximoTipo} criado a partir deste disparo`)
    } catch {
      addToast('error', 'Erro ao avançar esteira')
    } finally {
      setAvancando(false)
    }
  }

  function toggleCasa(casaId: string) {
    setFormData((prev) => {
      const exists = prev.casasAposta.includes(casaId)
      return {
        ...prev,
        casasAposta: exists
          ? prev.casasAposta.filter((id) => id !== casaId)
          : [...prev.casasAposta, casaId],
      }
    })
  }

  return (
    <>
      <PageHeader
        titulo={disparo.nomenclatura}
        descricao={`ID: ${disparo.id.slice(0, 8)}...`}
        acoes={
          <div className="flex items-center gap-2">
            <Link href="/disparos">
              <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />}>
                Voltar
              </Button>
            </Link>
            {!modoEdicao && disparo.status !== 'executado' && disparo.status !== 'cancelado' && (
              <Button
                variant="primary"
                size="sm"
                icon={<Play size={16} />}
                onClick={handleExecutar}
                loading={executando}
              >
                Executar
              </Button>
            )}
            {modoEdicao ? (
              <>
                <Button variant="ghost" size="sm" onClick={toggleEdicao} icon={<X size={16} />}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave} icon={<Check size={16} />}>
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSyncTracking}
                  loading={sincronizandoTracking}
                  icon={<RefreshCw size={16} />}
                >
                  Tracking
                </Button>
                <Button variant="secondary" size="sm" onClick={toggleEdicao} icon={<Pencil size={16} />}>
                  Editar
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} icon={<Trash2 size={16} />}>
                  Excluir
                </Button>
              </>
            )}
          </div>
        }
      />
      <div className="p-6 max-w-2xl">
        {modoEdicao ? (
          <div className="space-y-5">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as StatusDisparo }))}
            />
            <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4 space-y-4">
              <div>
                <span className="text-xs text-[var(--text-muted)] block mb-3">Números Sendpulse</span>
                <StepNumero
                  numeros={formData.numerosSendpulse}
                  onChange={(n) => setFormData({ ...formData, numerosSendpulse: n })}
                />
              </div>
              {(fluxosDisponiveis.length > 0 || carregandoFluxos) && (
                <div>
                  <span className="text-xs text-[var(--text-muted)] block mb-2">Fluxos Receptivos</span>
                  {carregandoFluxos && !fluxosDisponiveis.length ? (
                    <span className="text-[10px] text-[var(--text-muted)]">carregando fluxos...</span>
                  ) : (
                    <div className="space-y-3">
                      {formData.numerosSendpulse.map((num) => {
                        const flowsDoNumero = fluxosDisponiveis.filter((f) => f.botId === num.id)
                        if (!flowsDoNumero.length) return null
                        return (
                          <div key={num.id}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-sm font-medium text-[var(--text-primary)]">{num.numero}</span>
                              <span className="text-xs text-[var(--text-secondary)]">({num.nome})</span>
                            </div>
                            <div className="space-y-0.5">
                              {flowsDoNumero.map((flow) => {
                                const cfg = getState().flowTagConfigs[flow.id]
                                const selected = formData.flowIds.includes(flow.id)
                                return (
                                  <label
                                    key={flow.id}
                                    className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-[var(--bg-hover)]"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() =>
                                        setFormData((prev) => ({
                                          ...prev,
                                          flowIds: selected
                                            ? prev.flowIds.filter((id) => id !== flow.id)
                                            : [...prev.flowIds, flow.id],
                                        }))
                                      }
                                      className="accent-[var(--d1)]"
                                    />
                                    <span className="text-sm text-[var(--text-primary)]">{flow.nome}</span>
                                    {cfg?.funil && <span className="text-xs text-[var(--text-muted)]">({cfg.funil})</span>}
                                    <span className={`text-[10px] ${flow.status === 'ativo' ? 'text-green-500' : 'text-red-400'}`}>
                                      {flow.status}
                                    </span>
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
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Data"
                type="date"
                value={formData.dataDisparo}
                onChange={(e) => setFormData((prev) => ({ ...prev, dataDisparo: e.target.value }))}
              />
              <Input
                label="Horário"
                type="time"
                value={formData.horarioDisparo}
                onChange={(e) => setFormData((prev) => ({ ...prev, horarioDisparo: e.target.value }))}
              />
            </div>
            <Select
              label="Status da Base"
              options={BASE_STATUS_OPTIONS}
              value={formData.baseStatus}
              onChange={(e) => setFormData((prev) => ({ ...prev, baseStatus: e.target.value as StatusBase }))}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-secondary)] font-medium">Casas de Aposta</span>
              <div className="flex flex-wrap gap-2">
                {casasList.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-1.5 px-2.5 h-8 text-xs rounded cursor-pointer border transition-colors"
                    style={{
                      borderColor: formData.casasAposta.includes(c.id) ? c.cor : 'var(--border)',
                      backgroundColor: formData.casasAposta.includes(c.id) ? c.cor + '20' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.casasAposta.includes(c.id)}
                      onChange={() => toggleCasa(c.id)}
                      className="hidden"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: c.cor }}
                    />
                    {c.nome}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-secondary)] font-medium">Notas</span>
              <textarea
                value={formData.notas}
                onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
                className="h-24 px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors resize-none"
              />
            </div>
            <Input
              label="UTM (Superbet)"
              placeholder="ex: superbet_fev_d1"
              value={formData.utm}
              onChange={(e) => setFormData((prev) => ({ ...prev, utm: e.target.value }))}
            />
            <Input
              label="PID (BetMGM)"
              placeholder="ex: 13382"
              value={formData.betmgmPid}
              onChange={(e) => setFormData((prev) => ({ ...prev, betmgmPid: e.target.value }))}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-secondary)] font-medium">Painel CPA</span>
              <select
                value={formData.cpaPainelId}
                onChange={(e) => setFormData((prev) => ({ ...prev, cpaPainelId: e.target.value }))}
                className="h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              >
                <option value="">Nenhum</option>
                {formData.casasAposta.map((cId) => {
                  const c = casas[cId]
                  if (!c || !c.paineisCPA?.length) return null
                  return c.paineisCPA.map((p) => (
                    <option key={p.id} value={p.id}>
                      {c.nome} — {p.nome} (R$ {p.valorCPA.toFixed(2)})
                    </option>
                  ))
                })}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Disparos entregues DAXX"
                type="number"
                min="0"
                value={formData.entreguesDaxx}
                onChange={(e) => setFormData((prev) => ({ ...prev, entreguesDaxx: parseInt(e.target.value) || 0 }))}
              />
              <Input
                label="Leads no Fluxo"
                type="number"
                min="0"
                value={formData.leadsFluxo}
                onChange={(e) => setFormData((prev) => ({ ...prev, leadsFluxo: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                <span className="text-xs text-[var(--text-muted)] block mb-1">Tipo</span>
                <Badge variant="tipo" value={disparo.tipo} />
              </div>
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                <span className="text-xs text-[var(--text-muted)] block mb-1">Status</span>
                <Dropdown label={<span className="flex items-center gap-1.5"><StatusDot status={disparo.status} /><span className="capitalize">{disparo.status.replace('_', ' ')}</span></span>}>
                  <div className="p-1 min-w-[140px]">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          update(id, { status: opt.value as StatusDisparo })
                          addToast('success', `Status alterado para ${opt.label}`)
                        }}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded transition-colors ${
                          opt.value === disparo.status
                            ? 'text-[var(--d1)] bg-[var(--d1)]/10'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                        }`}
                      >
                        {opt.value === disparo.status && <Check size={14} className="text-[var(--d1)]" />}
                        <span className={opt.value === disparo.status ? '' : 'ml-6'}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </Dropdown>
              </div>
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                <span className="text-xs text-[var(--text-muted)] block mb-1">Data</span>
                <span className="text-sm text-[var(--text-primary)]">{disparo.dataDisparo}</span>
              </div>
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                <span className="text-xs text-[var(--text-muted)] block mb-1">Horário</span>
                <span className="text-sm text-[var(--text-primary)]">{disparo.horarioDisparo}</span>
              </div>
            </div>

            <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-2">Casas de Aposta</span>
              <div className="flex flex-wrap gap-1.5">
                {disparo.casasAposta.map((cId) => {
                  const c = casas[cId]
                  if (!c) return null
                  return <Chip key={cId} label={c.nome} cor={c.cor} size="md" />
                })}
              </div>
            </div>

            <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-2">Base CSV</span>
              <div className="text-sm text-[var(--text-primary)]">
                <span className="capitalize">{disparo.base.status}</span>
                {disparo.base.nomeArquivo && (
                  <span className="text-[var(--text-secondary)] ml-2">({disparo.base.nomeArquivo})</span>
                )}
                {disparo.base.totalRegistros && (
                  <>
                    <span className="text-[var(--text-muted)] ml-2">· {disparo.base.totalRegistros} registros</span>
                    <span className="text-[var(--d2)] ml-2 font-medium">R$ {(disparo.base.totalRegistros * 0.13).toFixed(2)}</span>
                  </>
                )}
              </div>
            </div>

            {disparo.templateDaxx && (
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                <span className="text-xs text-[var(--text-muted)] block mb-2">Template DAXX</span>
                <span className="text-sm text-[var(--text-primary)]">{disparo.templateDaxx.nome}</span>
                {disparo.templateDaxx.url && (
                  <a
                    href={disparo.templateDaxx.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--d1)] ml-2 hover:underline"
                  >
                    Ver destino
                  </a>
                )}
              </div>
            )}

            <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-3">Números e Fluxos</span>
              {disparo.numerosSendpulse && disparo.numerosSendpulse.length > 0 && (
                <div className="space-y-2">
                  {disparo.numerosSendpulse.map((n) => (
                    <div key={n.id} className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-primary)] font-medium">{n.numero}</span>
                      <span className="text-xs text-[var(--text-secondary)]">({n.nome})</span>
                      <span className={`inline-flex items-center gap-1 text-xs ${n.status === 'ativo' ? 'text-green-500' : 'text-red-400'}`}>
                        {n.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        {n.inboxNaoLidas > 0 && (
                          <span className="ml-1 px-1 py-0.5 rounded-full text-[10px] bg-[var(--d1)]/20 text-[var(--d1)]">
                            {n.inboxNaoLidas} não lida(s)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {(() => {
                const flowIds = disparo.flowIds ?? (disparo.flowId ? [disparo.flowId] : [])
                if (!flowIds.length) return null
                return (
                  <div className={`${disparo.numerosSendpulse?.length ? 'mt-3 pt-3 border-t border-[var(--border)]' : ''}`}>
                    <span className="text-[var(--text-muted)] text-xs block mb-2">Fluxos Receptivos</span>
                    <div className="flex flex-wrap gap-1.5">
                      {flowIds.map((fid) => {
                        const cfg = getState().flowTagConfigs[fid]
                        const fluxoNome = fluxosDisponiveis.find((f) => f.id === fid)?.nome ?? cfg?.flowId ?? fid
                        return (
                          <span key={fid} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-[var(--d1)]/10 border border-[var(--d1)]/30 text-[var(--d1)]">
                            {fluxoNome}
                            {cfg?.funil && <span className="text-[var(--text-muted)]">({cfg.funil})</span>}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            {disparo.notas && (
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                <span className="text-xs text-[var(--text-muted)] block mb-2">Notas</span>
                <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{disparo.notas}</p>
              </div>
            )}

            {(disparo.utm || disparo.cpaPainelId) && (
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                <span className="text-xs text-[var(--text-muted)] block mb-2">CPA / UTM</span>
                <div className="flex items-center gap-4 text-sm">
                  {disparo.utm && (
                    <div>
                      <span className="text-[var(--text-muted)] text-xs block">UTM</span>
                      <span className="text-[var(--text-primary)] font-mono">{disparo.utm}</span>
                    </div>
                  )}
                  {(() => {
                    if (!disparo.cpaPainelId) return null
                    for (const cId of disparo.casasAposta) {
                      const c = casas[cId]
                      if (!c) continue
                      const painel = c.paineisCPA?.find((p) => p.id === disparo.cpaPainelId)
                      if (painel) return (
                        <div>
                          <span className="text-[var(--text-muted)] text-xs block">Painel CPA</span>
                          <span className="text-[var(--text-primary)] font-mono">{c.nome} — {painel.nome} (R$ {painel.valorCPA.toFixed(2)})</span>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              </div>
            )}

            {(() => {
              const c = disparo.conversao
              if (!c && !disparo.conversao) return null
              const pct = c && c.entreguesDaxx > 0 ? ((c.leadsFluxo / c.entreguesDaxx) * 100).toFixed(1) : null
              return (
                <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                  <span className="text-xs text-[var(--text-muted)] block mb-2">Conversão</span>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)] text-xs block">Entregues DAXX</span>
                      <span className="text-[var(--text-primary)] font-mono text-base">{c?.entreguesDaxx ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-xs block">Leads no Fluxo</span>
                      <span className="text-[var(--text-primary)] font-mono text-base">
                        {c?.leadsFluxo ?? '—'}
                        {carregandoLeads && <span className="ml-1 text-[10px] text-[var(--text-muted)]">carregando...</span>}
                      </span>
                    </div>
                    {pct !== null && (
                      <div>
                        <span className="text-[var(--text-muted)] text-xs block">Conversão</span>
                        <span className="text-lg font-bold text-[var(--d1)]">{pct}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {(() => {
              const r = disparo.resultados
              if (!r?.registros && !r?.ftds) return null
              return (
                <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                  <span className="text-xs text-[var(--text-muted)] block mb-2">Tracking (3CGG)</span>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)] text-xs block">Registros</span>
                      <span className="text-[var(--text-primary)] font-mono text-base">{r.registros ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-xs block">FTDs</span>
                      <span className="text-[var(--d1)] font-mono text-base">{r.ftds ?? 0}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--text-muted)] font-medium">Resultados</span>
                <button
                  onClick={() => {
                    if (!editandoResultados) {
                      setResForm({
                        registros: disparo.resultados?.registros ?? 0,
                        ftds: disparo.resultados?.ftds ?? 0,
                        cpas: disparo.resultados?.cpas ?? 0,
                        valorTotalBase: disparo.valorTotalBase ?? 0,
                      })
                    } else {
                      const painel = Object.values(casas)
                        .flatMap((c) => c.paineisCPA ?? [])
                        .find((p) => p.id === disparo.cpaPainelId)
                      const valorCPA = painel?.valorCPA ?? 0
                      update(id, {
                        valorTotalBase: resForm.valorTotalBase || undefined,
                        resultados: {
                          registros: resForm.registros ?? 0,
                          ftds: resForm.ftds ?? 0,
                          cpas: resForm.cpas ?? 0,
                          custo: (resForm.valorTotalBase ?? 0) * 0.13,
                          valorFaturadoCPA: (resForm.cpas ?? 0) * valorCPA,
                          atualizadoEm: new Date().toISOString(),
                        },
                      })
                    }
                    setEditandoResultados(!editandoResultados)
                  }}
                  className="text-xs text-[var(--d1)] hover:underline"
                >
                  {editandoResultados ? 'Salvar' : 'Editar'}
                </button>
              </div>
              {editandoResultados ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Registros"
                      type="number"
                      min="0"
                      value={resForm.registros ?? 0}
                      onChange={(e) => setResForm((prev) => ({ ...prev, registros: parseInt(e.target.value) || 0 }))}
                    />
                    <Input
                      label="FTDs"
                      type="number"
                      min="0"
                      value={resForm.ftds ?? 0}
                      onChange={(e) => setResForm((prev) => ({ ...prev, ftds: parseInt(e.target.value) || 0 }))}
                    />
                    <Input
                      label="CPAs"
                      type="number"
                      min="0"
                      value={resForm.cpas ?? 0}
                      onChange={(e) => setResForm((prev) => ({ ...prev, cpas: parseInt(e.target.value) || 0 }))}
                    />
                    <Input
                      label="Valor Total Base"
                      type="number"
                      step="0.01"
                      min="0"
                      value={resForm.valorTotalBase ?? 0}
                      onChange={(e) => setResForm((prev) => ({ ...prev, valorTotalBase: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  {(() => {
                    const painel = Object.values(casas)
                      .flatMap((c) => c.paineisCPA ?? [])
                      .find((p) => p.id === disparo.cpaPainelId)
                    const valorCPA = painel?.valorCPA ?? 0
                    const vtb = resForm.valorTotalBase ?? 0
                    const cpas = resForm.cpas ?? 0
                    return (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
                        <div className="bg-[var(--bg-elevated)]/30 rounded p-3">
                          <span className="text-xs text-[var(--text-muted)] block">Custo (base × 0.13)</span>
                          <span className="text-sm font-semibold text-[var(--text-primary)]">R$ {(vtb * 0.13).toFixed(2)}</span>
                        </div>
                        <div className="bg-[var(--bg-elevated)]/30 rounded p-3">
                          <span className="text-xs text-[var(--text-muted)] block">Valor Faturado CPA (CPAs × R$ {valorCPA.toFixed(2)})</span>
                          <span className="text-sm font-semibold text-[var(--d3)]">R$ {(cpas * valorCPA).toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ) : disparo.resultados ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[var(--bg-elevated)]/30 rounded p-3">
                      <span className="text-xs text-[var(--text-muted)] block">Registros</span>
                      <span className="text-lg font-bold text-[var(--text-primary)]">{disparo.resultados.registros}</span>
                    </div>
                    <div className="bg-[var(--bg-elevated)]/30 rounded p-3">
                      <span className="text-xs text-[var(--text-muted)] block">FTDs</span>
                      <span className="text-lg font-bold text-[var(--d1)]">{disparo.resultados.ftds}</span>
                    </div>
                    <div className="bg-[var(--bg-elevated)]/30 rounded p-3">
                      <span className="text-xs text-[var(--text-muted)] block">CPAs</span>
                      <span className="text-lg font-bold text-[var(--d3)]">{disparo.resultados.cpas}</span>
                    </div>
                    <div className="bg-[var(--bg-elevated)]/30 rounded p-3">
                      <span className="text-xs text-[var(--text-muted)] block">Custo</span>
                      <span className="text-lg font-bold text-[var(--text-primary)]">R$ {disparo.resultados.custo.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="bg-[var(--bg-elevated)]/30 rounded p-3">
                    <span className="text-xs text-[var(--text-muted)] block">Valor Faturado CPA</span>
                    <span className="text-lg font-bold text-[var(--d3)]">R$ {disparo.resultados.valorFaturadoCPA.toFixed(2)}</span>
                  </div>
                  {disparo.resultados.atualizadoEm && (
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Atualizado em {new Date(disparo.resultados.atualizadoEm).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Nenhum resultado registrado. Clique em "Editar" para adicionar.</p>
              )}
            </div>

            {esteira && (
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Esteira</span>
                  <Link href="/esteiras" className="text-xs text-[var(--d1)] hover:underline">
                    Ver todas
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {['D1', 'D3', 'D5', 'D7'].map((tipo, i) => {
                    const chave = tipo.toLowerCase() as 'd1' | 'd3' | 'd5' | 'd7'
                    const disparoId = esteira.disparos[chave]
                    const isAtual = disparoId === disparo.id
                    const cores: Record<string, string> = { D1: 'var(--d1)', D3: 'var(--d3)', D5: 'var(--d5)', D7: 'var(--d7)' }
                    return (
                      <div key={tipo} className="flex items-center gap-2">
                        {i > 0 && <ChevronRight size={14} className="text-[var(--text-muted)]" />}
                        <Link
                          href={disparoId ? `/disparos/${disparoId}` : '#'}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            isAtual ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          } ${!disparoId ? 'opacity-30 cursor-default' : ''}`}
                          style={isAtual ? { backgroundColor: cores[tipo] } : {}}
                        >
                          {tipo}
                          {!disparoId && ' (—)'}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {podeAvancar && proximoTipo && !filhoExistente && (
              <div className="bg-[var(--bg-surface)] border border-[var(--d1)]/30 rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[var(--text-muted)] font-medium block mb-0.5">
                      Próximo passo: {proximoTipo}
                    </span>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Criar disparo {proximoTipo} a partir deste D1 executado
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Play size={14} />}
                    onClick={handleAvancarEsteira}
                    loading={avancando}
                  >
                    Criar {proximoTipo}
                  </Button>
                </div>
              </div>
            )}

            <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-3">Links</span>
              <div className="space-y-3">
                {disparo.casasAposta.map((cId) => {
                  const c = casas[cId]
                  if (!c) return null
                  const links = getByCasaAndTipo(cId, disparo.tipo)
                  if (links.length === 0) return null

                  return (
                    <div key={cId}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.cor }} />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">{c.nome}</span>
                        <span className="text-xs text-[var(--text-muted)]">({links.length})</span>
                      </div>
                      <div className="space-y-2">
                        {links.map((link) => {
                          const rendered = renderLinkTemplate(link.urlTemplate, c.variaveis)
                          const atribuido = isSelected(link.id)
                          return (
                            <div key={link.id} className="flex items-start gap-2 pl-4">
                              <button
                                onClick={() => toggleLink(link.id)}
                                className={`flex-shrink-0 flex items-center justify-center w-5 h-5 mt-0.5 rounded-full border transition-colors ${
                                  atribuido
                                    ? 'bg-[var(--d1)] border-[var(--d1)] text-white'
                                    : 'border-[var(--border)] hover:border-[var(--d1)]'
                                }`}
                                title={atribuido ? 'Remover' : 'Atribuir ao disparo'}
                              >
                                {atribuido && <Check size={10} />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-[var(--text-primary)] font-medium block">
                                  {link.nome}
                                </span>
                                <code className="text-[11px] text-[var(--d1)] font-mono break-all block">
                                  {rendered}
                                </code>
                              </div>
                              <a
                                href={rendered}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                                title="Abrir link"
                              >
                                <ExternalLink size={12} />
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(rendered)
                                  addToast('success', 'Link copiado')
                                }}
                                className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                                title="Copiar"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {disparo.casasAposta.every((cId) => {
                  const c = casas[cId]
                  return !c || getByCasaAndTipo(cId, disparo.tipo).length === 0
                }) && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Nenhum link configurado para {disparo.tipo} nesta casa.
                    <Link href="/casas/links" className="text-[var(--d1)] hover:underline ml-1">
                      Gerenciar links
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
