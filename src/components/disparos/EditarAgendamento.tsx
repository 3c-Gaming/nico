'use client'

import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'

/**
 * Edição inline da data/hora de um disparo agendado — usado nos painéis de detalhe (SMS/RCS).
 * Só muda `dataDisparo` / `horarioDisparo`; o cron de agendados repara na próxima passada.
 */
export function EditarAgendamento({
  dataDisparo,
  horarioDisparo,
  onSalvar,
}: {
  dataDisparo: string
  horarioDisparo: string
  onSalvar: (dataDisparo: string, horarioDisparo: string) => Promise<void> | void
}) {
  const [editando, setEditando] = useState(false)
  const [data, setData] = useState(dataDisparo)
  const [horario, setHorario] = useState(horarioDisparo || '10:00')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function abrir() {
    setData(dataDisparo)
    setHorario(horarioDisparo || '10:00')
    setErro(null)
    setEditando(true)
  }

  async function salvar() {
    if (!data || !horario) {
      setErro('Preencha data e hora')
      return
    }
    const quando = new Date(`${data}T${horario}:00-03:00`)
    if (Number.isNaN(quando.getTime())) {
      setErro('Data/hora inválida')
      return
    }
    if (quando <= new Date()) {
      setErro('Escolha uma data/hora no futuro')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await onSalvar(data, horario)
      setEditando(false)
    } catch (e) {
      setErro((e as Error).message || 'Não deu pra salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (!editando) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-primary)]">
          {dataDisparo} {horarioDisparo}
        </span>
        <button
          type="button"
          onClick={abrir}
          title="Editar agendamento"
          className="text-[var(--text-muted)] hover:text-[var(--d1)] transition-colors"
        >
          <Pencil size={11} />
        </button>
      </div>
    )
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="h-6 px-1.5 text-[11px] bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
        />
        <input
          type="time"
          value={horario}
          onChange={(e) => setHorario(e.target.value)}
          className="h-6 px-1.5 text-[11px] bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-6 px-1.5 rounded bg-[var(--d1)] text-white hover:brightness-110 disabled:opacity-50"
          title="Salvar"
        >
          <Check size={12} />
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="h-6 px-1.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          title="Cancelar edição"
        >
          <X size={12} />
        </button>
      </div>
      {erro && <div className="text-[10px] text-[var(--error)]">{erro}</div>}
    </div>
  )
}
