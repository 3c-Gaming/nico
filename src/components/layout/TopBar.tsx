'use client'

import { ThemeToggle } from '@/components/theme/ThemeToggle'

interface TopBarProps {
  titulo: string
  acoes?: React.ReactNode
}

export function TopBar({ titulo, acoes }: TopBarProps) {
  return (
    <div className="flex items-center justify-between h-14 px-6 border-b border-[var(--border)] bg-[var(--bg-surface)]">
      <h1 className="text-base font-semibold text-[var(--text-primary)]">{titulo}</h1>
      <div className="flex items-center gap-2">
        {acoes}
        <ThemeToggle />
      </div>
    </div>
  )
}
