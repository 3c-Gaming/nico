'use client'

import { useTheme } from '@/components/theme/ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      className="relative flex items-center gap-2 h-8 w-16 rounded-full px-1 transition-all duration-300"
      style={{
        backgroundColor: isDark ? 'var(--bg-elevated)' : 'var(--d1)',
        border: '1px solid var(--border)',
      }}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      <span
        className="absolute flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-300"
        style={{
          left: isDark ? '2px' : 'calc(100% - 26px)',
        }}
      >
        {isDark ? (
          <Sun size={12} className="text-amber-500" />
        ) : (
          <Moon size={12} className="text-indigo-600" />
        )}
      </span>
      <span className="flex-1" />
      <span className="flex-1" />
    </button>
  )
}
