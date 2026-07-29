'use client'

import { useState, useRef, useEffect } from 'react'

interface TagSuggestion {
  id: string
  name: string
  contactCount: number
}

interface TagComboBoxProps {
  botId: string
  value: string
  onChange: (value: string) => void
  onSelect: (tag: string) => void
  existingTags: string[]
  placeholder?: string
}

/** Combobox de tags reais da SendPulse pra esse bot (com contagem de contatos), igual ao UtmComboBox — mas ainda permite digitar uma tag nova que não existe lá. */
export function TagComboBox({ botId, value, onChange, onSelect, existingTags, placeholder }: TagComboBoxProps) {
  const [sugestoes, setSugestoes] = useState<TagSuggestion[]>([])
  const [carregando, setCarregando] = useState(false)
  const [desconectado, setDesconectado] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!botId) return
    let cancelado = false
    setCarregando(true)
    setDesconectado(false)
    fetch(`/api/sendpulse/tags?botId=${encodeURIComponent(botId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelado) return
        setSugestoes(json?.tags ?? [])
        setDesconectado(!!json?.desconectado)
      })
      .catch(() => { if (!cancelado) setSugestoes([]) })
      .finally(() => { if (!cancelado) setCarregando(false) })
    return () => { cancelado = true }
  }, [botId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const termo = value.trim().toLowerCase()
  const filtradas = sugestoes
    .filter((t) => !existingTags.includes(t.name))
    .filter((t) => !termo || t.name.toLowerCase().includes(termo))
  const existeExata = sugestoes.some((t) => t.name === value.trim())

  function selecionar(tag: string) {
    onSelect(tag)
    onChange('')
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = value.trim()
      if (val) selecionar(val)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
      />
      {open && (filtradas.length > 0 || carregando || desconectado || (value.trim() && !existeExata)) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md shadow-lg max-h-48 overflow-y-auto">
          {carregando && (
            <div className="px-3 py-1.5 text-xs text-[var(--text-muted)]">Carregando tags da SendPulse...</div>
          )}
          {!carregando && desconectado && (
            <div className="px-3 py-1.5 text-xs text-[var(--text-muted)]">
              Esse número está desconectado na SendPulse — não dá pra listar as tags dele automaticamente. Pode digitar o nome manualmente.
            </div>
          )}
          {filtradas.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selecionar(t.name)}
              className="flex items-center justify-between gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-[var(--bg-surface)] transition-colors"
            >
              <span className="text-[var(--text-primary)] font-mono truncate">{t.name}</span>
              <span className="text-[var(--text-muted)] shrink-0">{t.contactCount} contatos</span>
            </button>
          ))}
          {value.trim() && !existeExata && (
            <button
              type="button"
              onClick={() => selecionar(value.trim())}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors border-t border-[var(--border)]"
            >
              Usar “{value.trim()}” (tag nova, ainda não existe na SendPulse)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
