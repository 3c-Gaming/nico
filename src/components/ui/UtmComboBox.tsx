'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { useUtmConfigs } from '@/hooks/useUtmConfigs'
import { Chip } from './Chip'

const CASA_INFO = {
  superbet: { short: 'SB', cor: '#22c55e' },
  betmgm: { short: 'MGM', cor: '#6366f1' },
} as const

type Casa = keyof typeof CASA_INFO

interface UtmComboBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Restringe sugestões e criação a uma casa específica. Sem isso, detecta pelo formato (só dígitos = BetMGM). */
  casa?: Casa
  size?: 'sm' | 'md'
}

export function UtmComboBox({ value, onChange, placeholder, casa, size = 'sm' }: UtmComboBoxProps) {
  const { list, add } = useUtmConfigs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const termo = value.trim().toLowerCase()
  const filtered = list
    .filter((u) => !casa || u.casa === casa)
    .filter((u) => !termo || u.nome.toLowerCase().includes(termo) || u.valor.toLowerCase().includes(termo))
  const existeExato = list.some((u) => u.valor === value.trim())

  function resolverCasa(valor: string): Casa {
    return casa ?? (/^\d+$/.test(valor) ? 'betmgm' : 'superbet')
  }

  function selecionar(valor: string) {
    onChange(valor)
    setOpen(false)
  }

  function cadastrarNovo() {
    const valor = value.trim()
    if (!valor) return
    add({ nome: valor, valor, casa: resolverCasa(valor) })
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && value.trim() && !existeExato) {
      e.preventDefault()
      cadastrarNovo()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const inputClass =
    size === 'sm'
      ? 'h-7 px-2 text-xs font-mono bg-[var(--bg-base)]'
      : 'h-9 px-3 text-sm bg-[var(--bg-surface)]'

  return (
    <div ref={ref} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full ${inputClass} ${value ? 'pr-7' : ''} border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          title="Limpar"
        >
          <X size={size === 'sm' ? 12 : 14} />
        </button>
      )}
      {open && (filtered.length > 0 || (value.trim() && !existeExato)) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => selecionar(u.valor)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-[var(--bg-surface)] transition-colors"
            >
              <Chip label={CASA_INFO[u.casa].short} cor={CASA_INFO[u.casa].cor} size="sm" />
              <span className="text-[var(--text-primary)] truncate">{u.nome}</span>
              <span className="text-[var(--text-muted)] font-mono truncate ml-auto">{u.valor}</span>
            </button>
          ))}
          {value.trim() && !existeExato && (
            <button
              type="button"
              onClick={cadastrarNovo}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors border-t border-[var(--border)]"
            >
              <Plus size={12} className="flex-shrink-0" />
              Cadastrar “{value.trim()}” como novo {casa ? CASA_INFO[casa].short : 'UTM/PID'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
