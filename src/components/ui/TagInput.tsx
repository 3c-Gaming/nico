'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { Chip } from './Chip'

interface TagInputProps {
  tags: string[]
  casasDisponiveis: { id: string; nome: string; cor: string }[]
  onAdd: (nome: string) => { id: string; nome: string; cor: string }
  onRemove: (id: string) => void
  placeholder?: string
}

export function TagInput({
  tags,
  casasDisponiveis,
  onAdd,
  onRemove,
  placeholder = 'Digite o nome da casa...',
}: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = casasDisponiveis.filter(
    (c) =>
      c.nome.toLowerCase().includes(input.toLowerCase()) &&
      !tags.includes(c.id)
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      const casa = onAdd(input.trim())
      setInput('')
      setShowSuggestions(false)
    }
  }

  function selectCasa(id: string) {
    const casa = casasDisponiveis.find((c) => c.id === id)
    if (casa) {
      onAdd(casa.nome)
    }
    setInput('')
    setShowSuggestions(false)
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-9 px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded focus-within:border-[var(--border-strong)] transition-colors cursor-text"
        onClick={() => ref.current?.querySelector('input')?.focus()}
      >
        {tags.map((tagId) => {
          const casa = casasDisponiveis.find((c) => c.id === tagId)
          if (!casa) return null
          return (
            <Chip
              key={tagId}
              label={casa.nome}
              cor={casa.cor}
              onRemove={() => onRemove(tagId)}
            />
          )
        })}
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowSuggestions(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-0.5"
        />
      </div>
      {showSuggestions && input && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((casa) => (
            <button
              key={casa.id}
              onClick={() => selectCasa(casa.id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors text-left"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: casa.cor }}
              />
              {casa.nome}
              <Plus size={14} className="ml-auto text-[var(--text-muted)]" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
