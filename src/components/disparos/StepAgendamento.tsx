'use client'

import type { TipoDisparo, CasaAposta, BaseCSV, TemplateDaxx, NumeroSendpulse } from '@/types'
import { Input } from '../ui/Input'
import { TimePicker } from '../ui/TimePicker'
import { PreviewNomenclatura } from './PreviewNomenclatura'
import { EsteiraPreview } from './EsteiraPreview'

interface StepAgendamentoProps {
  tipo: TipoDisparo
  casasSelecionadas: string[]
  casasDisponiveis: Record<string, CasaAposta>
  dataDisparo: string
  horarioDisparo: string
  nomenclatura: string
  base: BaseCSV
  template?: TemplateDaxx
  numeros: NumeroSendpulse[]
  onChangeData: (data: string) => void
  onChangeHorario: (horario: string) => void
  onChangeNomenclatura: (nome: string) => void
}

export function StepAgendamento({
  tipo,
  casasSelecionadas,
  casasDisponiveis,
  dataDisparo,
  horarioDisparo,
  nomenclatura,
  base,
  template,
  numeros,
  onChangeData,
  onChangeHorario,
  onChangeNomenclatura,
}: StepAgendamentoProps) {
  const dataCriacao = new Date()
  const casas = casasSelecionadas.map((id) => casasDisponiveis[id]).filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            label="Data do Disparo"
            type="date"
            value={dataDisparo}
            onChange={(e) => onChangeData(e.target.value)}
          />
        </div>
        <div>
          <span className="text-xs text-[var(--text-secondary)] font-medium block mb-1">Horário</span>
          <TimePicker value={horarioDisparo} onChange={onChangeHorario} />
        </div>
      </div>

      <PreviewNomenclatura
        dataCriacao={dataCriacao}
        tipoDisparo={tipo}
        dataDisparo={dataDisparo ? new Date(dataDisparo + 'T12:00:00') : new Date()}
        casas={casas}
        value={nomenclatura}
        onChange={onChangeNomenclatura}
        editavel
      />

      {tipo === 'D1' && (
        <EsteiraPreview
          dataDisparo={dataDisparo}
          casas={casas}
          horario={horarioDisparo}
        />
      )}

      <div className="rounded-md border border-[var(--border)] p-3 space-y-2 text-sm">
        <span className="text-xs text-[var(--text-secondary)] font-medium block">Resumo</span>
        <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-primary)]">
          <span className="text-[var(--text-muted)]">Tipo:</span>
          <span>{tipo}</span>
          <span className="text-[var(--text-muted)]">Casas:</span>
          <span>{casas.map((c) => c.nome).join(', ') || 'Nenhuma'}</span>
          <span className="text-[var(--text-muted)]">Base:</span>
          <span>{base.status === 'disponivel' ? base.nomeArquivo || 'Selecionada' : 'Pendente'}</span>
          <span className="text-[var(--text-muted)]">Template:</span>
          <span>{template?.nome || 'Não selecionado'}</span>
          <span className="text-[var(--text-muted)]">Números:</span>
          <span>{numeros.map((n) => n.numero).join(', ') || 'Nenhum'}</span>
        </div>
      </div>
    </div>
  )
}
