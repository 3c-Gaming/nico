'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getState } from '@/lib/store'
import type { TipoDisparo, Disparo, BaseCSV, TemplateDaxx, NumeroSendpulse, FluxoSendpulse } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { useEsteiras } from '@/hooks/useEsteiras'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { criarEsteira } from '@/lib/esteira'
import { gerarNomenclatura } from '@/lib/nomenclatura'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { StepBase } from './StepBase'
import { StepBaseDrive } from './StepBaseDrive'
import { StepTemplate } from './StepTemplate'
import { StepNumero } from './StepNumero'
import { StepAgendamento } from './StepAgendamento'

const STEPS = ['Básico', 'Base CSV', 'Template', 'Número', 'Agendamento']

function fireAndForget(url: string, opts: RequestInit) {
  fetch(url, opts).catch(() => {})
}

export function FormNovoDisparo() {
  const router = useRouter()
  const { create: createDisparo } = useDisparos()
  const { create: createEsteira } = useEsteiras()
  const { casas: casasDisponiveis } = useCasasAposta()
  const { addToast } = useToast()

  const [step, setStep] = useState(1)
  const [tipo, setTipo] = useState<TipoDisparo | null>(null)
  const [casasSelecionadas, setCasasSelecionadas] = useState<string[]>([])
  const [notas, setNotas] = useState('')
  const [base, setBase] = useState<BaseCSV>({ status: 'pendente' })
  const [template, setTemplate] = useState<TemplateDaxx | undefined>()
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

  const podeAvancar = useMemo(() => {
    switch (step) {
      case 1: return !!tipo && casasSelecionadas.length > 0
      case 2: return base.status !== 'pendente' && base.status !== 'baixando'
      case 3: return true
      case 4: return true
      case 5: return !!dataDisparo && !!horarioDisparo
      default: return false
    }
  }, [step, tipo, casasSelecionadas, base, dataDisparo, horarioDisparo])

  function handleAvancar() {
    if (step < 5) setStep(step + 1)
  }

  function handleVoltar() {
    if (step > 1) setStep(step - 1)
  }

  async function handleCriar() {
    if (!tipo) return
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

      const disparoData: Disparo = {
        id: crypto.randomUUID(),
        tipo,
        nomenclatura: nomenclaturaFinal,
        status: 'rascunho',
        casasAposta: casasSelecionadas,
        dataDisparo,
        horarioDisparo,
        base,
        templateDaxx: template,
        numerosSendpulse: numeros.length > 0 ? numeros : undefined,
        utm: utm || undefined,
        betmgmPid: betmgmPid || undefined,
        flowIds: flowIds.length > 0 ? flowIds : undefined,
        criadoEm: now.toISOString(),
        atualizadoEm: now.toISOString(),
        notas: notas || undefined,
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
          <StepBase
            tipo={tipo}
            casasSelecionadas={casasSelecionadas}
            notas={notas}
            onChangeTipo={setTipo}
            onChangeCasas={setCasasSelecionadas}
            onChangeNotas={setNotas}
          />
        )}
        {step === 2 && <StepBaseDrive base={base} onChange={setBase} />}
        {step === 3 && <StepTemplate template={template} onChange={setTemplate} />}
        {step === 4 && (
          <div className="space-y-6">
            <StepNumero numeros={numeros} onChange={setNumeros} />
            {numeros.length > 0 && (
              <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4 space-y-3">
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
          </div>
        )}
        {step === 5 && (
          <StepAgendamento
            tipo={tipo!}
            casasSelecionadas={casasSelecionadas}
            casasDisponiveis={casasDisponiveis}
            dataDisparo={dataDisparo}
            horarioDisparo={horarioDisparo}
            nomenclatura={nomenclatura}
            base={base}
            template={template}
            numeros={numeros}
            utm={utm}
            betmgmPid={betmgmPid}
            onChangeData={setDataDisparo}
            onChangeHorario={setHorarioDisparo}
            onChangeNomenclatura={setNomenclatura}
            onChangeUtm={setUtm}
            onChangeBetmgmPid={setBetmgmPid}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-[var(--border)]">
        <Button variant="ghost" onClick={handleVoltar} disabled={step === 1}>
          Voltar
        </Button>
        {step < 5 ? (
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
