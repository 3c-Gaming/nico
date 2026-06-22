'use client'

import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const [h, m] = value.split(':').map(Number)

  const horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutos = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors w-full"
      >
        <Clock size={14} className="text-[var(--text-muted)]" />
        {value || 'Selecionar horário'}
      </button>
      {open && (
        <div className="absolute top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md shadow-lg p-2 flex gap-2">
          <div className="h-48 overflow-y-auto space-y-0.5">
            {horas.map((hora) => (
              <button
                key={hora}
                onClick={() => {
                  onChange(`${hora}:${String(m ?? 0).padStart(2, '0')}`)
                }}
                className={`block w-14 px-2 py-1 text-xs rounded text-center transition-colors ${
                  h === Number(hora)
                    ? 'bg-[var(--d1)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                {hora}
              </button>
            ))}
          </div>
          <div className="h-48 overflow-y-auto space-y-0.5">
            {minutos.map((min) => (
              <button
                key={min}
                onClick={() => {
                  onChange(`${String(h ?? 0).padStart(2, '0')}:${min}`)
                  setOpen(false)
                }}
                className={`block w-14 px-2 py-1 text-xs rounded text-center transition-colors ${
                  m === Number(min)
                    ? 'bg-[var(--d1)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                {min}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
