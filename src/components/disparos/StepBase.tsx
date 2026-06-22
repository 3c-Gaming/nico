'use client'

import type { TipoDisparo } from '@/types'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { TagInput } from '../ui/TagInput'

interface StepBaseProps {
  tipo: TipoDisparo | null
  casasSelecionadas: string[]
  notas: string
  onChangeTipo: (tipo: TipoDisparo) => void
  onChangeCasas: (casas: string[]) => void
  onChangeNotas: (notas: string) => void
}

export function StepBase({
  tipo,
  casasSelecionadas,
  notas,
  onChangeTipo,
  onChangeCasas,
  onChangeNotas,
}: StepBaseProps) {
  const { list: casasDisponiveis, add: addCasa } = useCasasAposta()

  return (
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
              onClick={() => onChangeTipo(opt.value)}
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
              <p className="text-xs text-[var(--text-secondary)] mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs text-[var(--text-secondary)] font-medium mb-3 block">
          Casas de Aposta
        </span>
        <TagInput
          tags={casasSelecionadas}
          casasDisponiveis={casasDisponiveis.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor }))}
          onAdd={(nome) => {
            const casa = addCasa(nome)
            if (!casasSelecionadas.includes(casa.id)) {
              onChangeCasas([...casasSelecionadas, casa.id])
            }
            return { id: casa.id, nome: casa.nome, cor: casa.cor }
          }}
          onRemove={(id) => onChangeCasas(casasSelecionadas.filter((c) => c !== id))}
        />
      </div>

      <div>
        <span className="text-xs text-[var(--text-secondary)] font-medium mb-3 block">
          Notas <span className="text-[var(--text-muted)]">(opcional)</span>
        </span>
        <textarea
          value={notas}
          onChange={(e) => onChangeNotas(e.target.value)}
          placeholder="Observações internas sobre o disparo..."
          rows={3}
          className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] resize-none"
        />
      </div>
    </div>
  )
}
