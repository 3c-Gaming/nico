'use client'

import { X } from 'lucide-react'

interface ChipProps {
  label: string
  cor: string
  onRemove?: () => void
  size?: 'sm' | 'md'
}

export function Chip({ label, cor, onRemove, size = 'sm' }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      }`}
      style={{
        backgroundColor: `${cor}20`,
        color: cor,
        border: `1px solid ${cor}30`,
      }}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-80 rounded-full"
          style={{ color: cor }}
        >
          <X size={10} />
        </button>
      )}
    </span>
  )
}
