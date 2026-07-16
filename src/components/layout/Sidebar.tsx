'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, List, GitBranch, Dices, Settings, Send, Plus, Menu, ChevronLeft, Layers, Trophy, Smartphone, FileText, ClipboardList } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTheme } from '@/components/theme/ThemeProvider'

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/demandas', label: 'Demandas', icon: ClipboardList },
  { href: '/calendario', label: 'Calendário', icon: Calendar },
  { href: '/disparos', label: 'Disparos', icon: List },
  { href: '/esteiras', label: 'Esteiras', icon: GitBranch },
  { href: '/numeros', label: 'Números', icon: null },
  { href: '/testes', label: 'Testes', icon: Smartphone },
  { href: '/funis', label: 'Funis', icon: Layers },
  { href: '/paginas', label: 'Páginas', icon: FileText },
  { href: '/copa-2026', label: 'Copa 2026', icon: null },
  { href: '/casas', label: 'Casas', icon: Dices },
  { href: '/bases', label: 'Bases', icon: null },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/daxx', label: 'daxX', icon: Send },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]"
      >
        <Menu size={18} />
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] transition-all duration-200 ${
          mobileOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full w-[240px]'
        } lg:translate-x-0 ${collapsed ? 'lg:w-[60px]' : 'lg:w-[240px]'}`}
      >
        <div className={`flex items-center h-14 border-b border-[var(--border)] gap-1 ${collapsed ? 'lg:justify-center' : 'px-4'}`}>
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Nico"
              className="block h-7 w-7 shrink-0"
              style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }}
            />
            {!collapsed && (
              <span className="font-mono text-lg tracking-tight text-[var(--text-primary)]">
                <h1 className="text-lg font-bold">Nico</h1>
                <p className="text-[10px] text-[var(--text-muted)]">Assistente de Disparos</p>
              </span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 ml-auto rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          >
            <ChevronLeft size={16} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {LINKS.map((link) => {
            const Icon = link.icon
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 h-9 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-l-2 border-[var(--d1)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                } ${collapsed ? 'lg:justify-center lg:px-0 lg:border-l-0' : 'px-3'}`}
                title={collapsed ? link.label : undefined}
              >
                {Icon ? (
                  <Icon size={18} className="flex-shrink-0" />
                ) : link.href === '/copa-2026' ? (
                  <>
                    <img
                      src="/world-cup-dark.png"
                      alt=""
                      width={18}
                      height={18}
                      className="flex-shrink-0 block dark:hidden"
                    />
                    <img
                      src="/world-cup-white.png"
                      alt=""
                      width={18}
                      height={18}
                      className="flex-shrink-0 hidden dark:block"
                    />
                  </>
                ) : (
                  <img
                    src={link.href === '/numeros' ? '/whatsapp.png' : '/gdrive.png'}
                    alt=""
                    width={18}
                    height={18}
                    className="flex-shrink-0"
                  />
                )}
                {!collapsed && <span>{link.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className={`px-2 pb-4 ${collapsed ? 'lg:px-1' : ''}`}>
          <Link
            href="/disparos/novo"
            className={`flex items-center gap-2 h-9 rounded-md text-sm font-medium text-white transition-colors hover:brightness-110 ${
              collapsed ? 'lg:justify-center lg:px-0' : 'px-3'
            }`}
            style={{ backgroundColor: 'var(--d1)' }}
            title={collapsed ? 'Novo D1' : undefined}
          >
            <Plus size={18} />
            {!collapsed && <span>Novo D1</span>}
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}
