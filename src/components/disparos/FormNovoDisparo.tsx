'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getState } from '@/lib/store'
import type { TipoDisparo, Disparo, BaseCSV, NumeroSendpulse, FluxoSendpulse, DisparoDaxx, CasaAposta } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { useEsteiras } from '@/hooks/useEsteiras'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { criarEsteira } from '@/lib/esteira'
import { gerarNomenclatura } from '@/lib/nomenclatura'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { TimePicker } from '../ui/TimePicker'
import { useToast } from '../ui/Toast'
import { TagInput } from '../ui/TagInput'
import { StepDaxxCampanha } from './StepDaxxCampanha'
import { StepNumero } from './StepNumero'
import { PreviewNomenclatura } from './PreviewNomenclatura'
import { EsteiraPreview } from './EsteiraPreview'

const STEPS = ['Campanha DAXX', 'Configuração']

function fireAndForget(url: string, opts: RequestInit) {
  fetch(url, opts).catch(() => {})
}

function detectCasa(nome: string, casas: Record<string, CasaAposta>): string | undefined {
  const slug = nome
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .find((w) => {
      const lower = w.toLowerCase()
      return Object.values(casas).some((c) =>
        c.slug.toLowerCase().includes(lower) || lower.includes(c.slug.toLowerCase())
      )
    })
  if (!slug) return
  const found = Object.values(casas).find((c) =>
    c.slug.toLowerCase().includes(slug.toLowerCase()) || slug.toLowerCase().includes(c.slug.toLowerCase())
  )
  return found?.id
}

export function FormNovoDisparo() {
  const router = useRouter()
  const { create: createDisparo } = useDisparos()
  const { create: createEsteira } = useEsteiras()
  const { casas: casasDisponiveis, add: addCasa } = useCasasAposta()
  const { addToast } = useToast()

  const [step, setStep] = useState(1)
  const [campanha, setCampanha] = useState<DisparoDaxx | undefined>()

  const [tipo, setTipo] = useState<TipoDisparo | null>(null)
  const [casasSelecionadas, setCasasSelecionadas] = useState<string[]>([])
  const [notas, setNotas] = useState('')
  const [numeros, setNumeros] = useState<NumeroSendpulse[]>([])
  const [dataDisparo, setDataDisparo] = useState('')
  const [horarioDisparo, setHorarioDisparo] = useState('09:30')
  const [nomenclatura, setNomenclatura] = useState('')
  const [utm, setUtm] = useState('')
  const [betmgmPid, setBetmgmPid] = useState('')
  const [flowIds, setFlowIds] = useState<string[]>([])
  const [fluxosDisponiveis, setFluxosDisponiveis] = useState<FluxoSendpulse[]>([])
  const [carregandoFluxos, setCarregandoFluxos] = useState(false)
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    if (!numeros.length) { setFluxosDisponiveis([]); return }
    setCarregandoFluxos(true)
    const botIds = [...new Set(numeros.map((n) => n.id))]
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
  }, [numeros])

  useEffect(() => {
    if (campanha && !nomenclatura) {
      setNomenclatura(campanha.nome)
    }
  }, [campanha])

  useEffect(() => {
    if (campanha && casasSelecionadas.length === 0) {
      const casaId = detectCasa(campanha.nome, casasDisponiveis)
      if (casaId) setCasasSelecionadas([casaId])
    }
  }, [campanha, casasDisponiveis])

  const podeAvancar = useMemo(() => {
    switch (step) {
      case 1: return !!campanha
      case 2: return !!tipo && !!dataDisparo && !!horarioDisparo
      default: return false
    }
  }, [step, campanha, tipo, dataDisparo, horarioDisparo])

  function handleAvancar() {
    if (step < 2) setStep(step + 1)
  }

  function handleVoltar() {
    if (step > 1) setStep(step - 1)
  }

  async function handleCriar() {
    if (!tipo || !campanha) return
    setCriando(true)

    try {
      const now = new Date()
      const dataCriacao = now

      const nomenclaturaFinal = nomenclatura || gerarNomenclatura({
        dataCriacao,
        tipoDisparo: tipo,
        dataDisparo: dataDisparo ? new Date(dataDisparo + 'T12:00:00') : now,
        casas: casasSelecionadas.map((id) => casasDisponiveis[id]).filter(Boolean),
      })

      const base: BaseCSV = {
        status: 'disponivel',
        totalRegistros: campanha.totalBase,
        nomeArquivo: `DAXX: ${campanha.nome}`,
      }

      const disparoData: Disparo = {
        id: crypto.randomUUID(),
        tipo,
        nomenclatura: nomenclaturaFinal,
        status: 'rascunho',
        casasAposta: casasSelecionadas,
        dataDisparo,
        horarioDisparo,
        base,
        templateDaxx: {
          id: campanha.id,
          nome: campanha.nome,
          url: campanha.linkTemplate,
          descricao: `Base: ${campanha.totalBase} | Entregues: ${campanha.entregues} | Lidas: ${campanha.lidas}`,
        },
        numerosSendpulse: numeros.length > 0 ? numeros : undefined,
        utm: utm || undefined,
        betmgmPid: betmgmPid || undefined,
        flowIds: flowIds.length > 0 ? flowIds : undefined,
        criadoEm: now.toISOString(),
        atualizadoEm: now.toISOString(),
        notas: notas || undefined,
        valorTotalBase: campanha.totalBase,
        conversao: {
          entreguesDaxx: campanha.entregues,
          leadsFluxo: 0,
          atualizadoEm: now.toISOString(),
        },
      }

      if (tipo === 'D1') {
        const { esteira, filhos } = criarEsteira(disparoData, Object.values(casasDisponiveis))
        createDisparo(disparoData)
        for (const f of filhos) createDisparo(f)
        createEsteira(esteira)
        fireAndForget('/api/disparos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disparo: disparoData, esteira, filhos }),
        })
      } else {
        createDisparo(disparoData)
        fireAndForget('/api/disparos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disparo: disparoData }),
        })
      }

      addToast('success', `${tipo} criado com sucesso!`)
      router.push('/calendario')
    } catch {
      addToast('error', 'Erro ao criar disparo')
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => {
          const num = i + 1
          const active = num === step
          const done = num < step
          return (
            <div key={num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[var(--d1)] text-white'
                      : done
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                  }`}
                >
                  {done ? '✓' : num}
                </div>
                <span className={`text-[11px] mt-1 ${active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${num <= step ? 'bg-[var(--d1)]' : 'bg-[var(--border)]'}`} />
              )}
            </div>
          )
        })}
      </div>

      <div className="min-h-[300px]">
        {step === 1 && (
          <StepDaxxCampanha campanha={campanha} onChange={setCampanha} />
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs text-[var(--text-secondary)] font-medium mb-3 block">
                Tipo de Disparo
              </span>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'D1' as const, label: 'D1 — Base Nova', desc: 'Cria esteira automática D3/D5/D7' },
                  { value: 'PONTUAL' as const, label: 'Pontual — Sem esteira', desc: 'Disparo avulso, sem sequência' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTipo(opt.value)}
                    className={`p-4 rounded-md border text-left transition-all ${
                      tipo === opt.value
                        ? 'border-[var(--d1)] bg-[var(--d1)]/10'
                        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold ${tipo === opt.value ? 'text-[var(--d1)]' : 'text-[var(--text-primary)]'}`}
                    >
                      {opt.label}
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs text-[var(--text-secondary)] font-medium mb-2 block">Casas de Aposta</span>
              <TagInput
                tags={casasSelecionadas}
                casasDisponiveis={Object.values(casasDisponiveis).map((c) => ({ id: c.id, nome: c.nome, cor: c.cor }))}
                onAdd={(nome) => {
                  const casa = addCasa(nome)
                  setCasasSelecionadas((prev) => prev.includes(casa.id) ? prev : [...prev, casa.id])
                  return { id: casa.id, nome: casa.nome, cor: casa.cor }
                }}
                onRemove={(id) => setCasasSelecionadas((prev) => prev.filter((c) => c !== id))}
                placeholder="Digite o nome da casa..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Data do Disparo"
                type="date"
                value={dataDisparo}
                onChange={(e) => setDataDisparo(e.target.value)}
              />
              <div>
                <span className="text-xs text-[var(--text-secondary)] font-medium block mb-1">Horário</span>
                <TimePicker value={horarioDisparo} onChange={setHorarioDisparo} />
              </div>
            </div>

            <PreviewNomenclatura
              dataCriacao={new Date()}
              tipoDisparo={tipo ?? 'D1'}
              dataDisparo={dataDisparo ? new Date(dataDisparo + 'T12:00:00') : new Date()}
              casas={casasSelecionadas.map((id) => casasDisponiveis[id]).filter(Boolean)}
              value={nomenclatura}
              onChange={setNomenclatura}
              editavel
            />

            {tipo === 'D1' && (
              <EsteiraPreview
                dataDisparo={dataDisparo}
                casas={casasSelecionadas.map((id) => casasDisponiveis[id]).filter(Boolean)}
                horario={horarioDisparo}
              />
            )}

            <StepNumero numeros={numeros} onChange={setNumeros} />

            {numeros.length > 0 && (
              <div className="rounded-md border border-[var(--border)] p-4 space-y-3">
                <span className="text-xs text-[var(--text-muted)] font-medium block">Fluxos Receptivos</span>
                {carregandoFluxos && !fluxosDisponiveis.length ? (
                  <span className="text-[10px] text-[var(--text-muted)]">carregando fluxos...</span>
                ) : fluxosDisponiveis.length === 0 ? (
                  <span className="text-[10px] text-[var(--text-muted)]">Nenhum fluxo disponível para os números selecionados</span>
                ) : (
                  <div className="space-y-3">
                    {numeros.map((num) => {
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
                              const selected = flowIds.includes(flow.id)
                              return (
                                <label key={flow.id} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-[var(--bg-hover)]">
                                  <input type="checkbox" checked={selected}
                                    onChange={() => setFlowIds((prev) =>
                                      selected ? prev.filter((id) => id !== flow.id) : [...prev, flow.id]
                                    )}
                                    className="accent-[var(--d1)]" />
                                  <span className="text-sm text-[var(--text-primary)]">{flow.nome}</span>
                                  {cfg?.funil && <span className="text-xs text-[var(--text-muted)]">({cfg.funil})</span>}
                                  <span className={`text-[10px] ${flow.status === 'ativo' ? 'text-green-500' : 'text-red-400'}`}>{flow.status}</span>
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

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="UTM"
                placeholder="ex: superbet_fev_d1"
                value={utm}
                onChange={(e) => setUtm(e.target.value)}
              />
              <Input
                label="PID (BetMGM)"
                placeholder="ex: 13382"
                value={betmgmPid}
                onChange={(e) => setBetmgmPid(e.target.value)}
              />
            </div>

            <div>
              <span className="text-xs text-[var(--text-secondary)] font-medium block mb-1">Notas (opcional)</span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observações sobre o disparo..."
                rows={3}
                className="w-full px-3 py-2 rounded-md text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--d1)] resize-none"
              />
            </div>

            {campanha && (
              <div className="rounded-md border border-[var(--border)] p-3 space-y-2 text-sm">
                <span className="text-xs text-[var(--text-secondary)] font-medium block">Dados da DAXX</span>
                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-primary)]">
                  <span className="text-[var(--text-muted)]">Campanha:</span>
                  <span>{campanha.nome}</span>
                  <span className="text-[var(--text-muted)]">Base:</span>
                  <span>{campanha.totalBase.toLocaleString('pt-BR')}</span>
                  <span className="text-[var(--text-muted)]">Entregues:</span>
                  <span className="text-green-500">{campanha.entregues.toLocaleString('pt-BR')}</span>
                  <span className="text-[var(--text-muted)]">Lidas:</span>
                  <span className="text-[var(--d1)]">{campanha.lidas.toLocaleString('pt-BR')}</span>
                  <span className="text-[var(--text-muted)]">Status:</span>
                  <span>{campanha.status}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-[var(--border)]">
        <Button variant="ghost" onClick={handleVoltar} disabled={step === 1}>
          Voltar
        </Button>
        {step < 2 ? (
          <Button onClick={handleAvancar} disabled={!podeAvancar}>
            Avançar
          </Button>
        ) : (
          <Button onClick={handleCriar} loading={criando} disabled={!podeAvancar}>
            Criar Disparo
          </Button>
        )}
      </div>
    </div>
  )
}
