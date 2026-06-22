'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, List, GitBranch, Building2, Plus, Menu } from 'lucide-react'
import { useState } from 'react'

const LINKS = [
  { href: '/calendario', label: 'Calendário', icon: Calendar },
  { href: '/disparos', label: 'Disparos', icon: List },
  { href: '/esteiras', label: 'Esteiras', icon: GitBranch },
  { href: '/casas', label: 'Casas', icon: Building2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]"
      >
        <Menu size={18} />
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] transition-all duration-200 ${
          collapsed ? '-translate-x-full lg:translate-x-0 lg:w-[60px]' : 'w-[240px] lg:w-[240px] translate-x-0'
        } ${collapsed ? 'lg:w-[60px]' : 'lg:w-[240px]'}`}
      >
        <div className={`flex items-center h-14 px-4 border-b border-[var(--border)] ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <Link href="/calendario" className="font-mono text-white text-lg tracking-tight">
            {collapsed ? 'n' : 'nico'}
          </Link>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {LINKS.map((link) => {
            const Icon = link.icon
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-l-2 border-[var(--d1)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                } ${collapsed ? 'lg:justify-center lg:px-0 lg:border-l-0' : ''}`}
                title={collapsed ? link.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
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

      {collapsed && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setCollapsed(false)}
        />
      )}
    </>
  )
}
