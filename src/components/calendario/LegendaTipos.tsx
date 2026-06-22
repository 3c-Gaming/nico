'use client'

const TIPOS = [
  { label: 'D1', cor: 'var(--d1)' },
  { label: 'D3', cor: 'var(--d3)' },
  { label: 'D5', cor: 'var(--d5)' },
  { label: 'D7', cor: 'var(--d7)' },
  { label: 'Pontual', cor: 'var(--pontual)' },
]

export function LegendaTipos() {
  return (
    <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
      {TIPOS.map((tipo) => (
        <span key={tipo.label} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm inline-block"
            style={{ backgroundColor: tipo.cor }}
          />
          {tipo.label}
        </span>
      ))}
    </div>
  )
}
