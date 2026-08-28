'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, List, GitBranch, Dices, Settings, Send, Plus, Menu, ChevronLeft, ChevronDown, Layers, Trophy, Smartphone, FileText, ClipboardList, Hash, LandPlot, Clover } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTheme } from '@/components/theme/ThemeProvider'

interface LinkItem {
  type: 'link'
  href: string
  label: string
  icon: typeof Home | null
}

interface GroupItem {
  type: 'group'
  label: string
  icon: typeof Home
  /** Sidebar recolhida vira um ícone só (sem dropdown) — leva pra cá. */
  hrefColapsado: string
  children: { href: string; label: string }[]
}

const NAV: (LinkItem | GroupItem)[] = [
  { type: 'link', href: '/', label: 'Geral', icon: Home },
  { type: 'link', href: '/calendario', label: 'Calendário', icon: Calendar },
  {
    type: 'group',
    label: 'Disparos',
    icon: Send,
    hrefColapsado: '/daxx',
    children: [
      { href: '/daxx', label: 'Geral' },
      { href: '/disparos/sms-rapido', label: 'SMS' },
      { href: '/disparos/telegram-rapido', label: 'Telegram' },
    ],
  },
  //{ href: '/esteiras', label: 'Esteiras', icon: GitBranch },
  { type: 'link', href: '/numeros', label: 'Números', icon: null },
  { type: 'link', href: '/utms', label: 'UTMs', icon: Hash },
  { type: 'link', href: '/testes', label: 'Testes', icon: Smartphone },
  { type: 'link', href: '/funis', label: 'Funis', icon: Layers },
  { type: 'link', href: '/jogos', label: 'Grade', icon: LandPlot },
  { type: 'link', href: '/pilhado-premios', label: 'Pilhado Prêmios', icon: Clover },
  { type: 'link', href: '/paginas', label: 'Páginas', icon: FileText },
  //{ href: '/copa-2026', label: 'Jogos', icon: LandPlot },
  { type: 'link', href: '/casas', label: 'Casas', icon: Dices },
  { type: 'link', href: '/bases', label: 'Bases', icon: null },
  { type: 'link', href: '/demandas', label: 'Demandas', icon: ClipboardList },
  { type: 'link', href: '/configuracoes', label: 'Configurações', icon: Settings },
  { type: 'link', href: '/resultados', label: 'Resultados', icon: Trophy },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Grupo abre sozinho quando a rota atual é um dos filhos (calculado no render); esse estado só
  // guarda quem o usuário abriu/fechou manualmente por cima disso.
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set())

  function toggleGrupo(label: string) {
    setGruposAbertos((prev) => {
      const novo = new Set(prev)
      if (novo.has(label)) novo.delete(label)
      else novo.add(label)
      return novo
    })
  }

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
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] transition-all duration-200 ${mobileOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full w-[240px]'
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
          {NAV.map((item) => {
            if (item.type === 'group') {
              const algumFilhoAtivo = item.children.some((c) => pathname.startsWith(c.href))
              const aberto = algumFilhoAtivo || gruposAbertos.has(item.label)
              const Icon = item.icon

              if (collapsed) {
                return (
                  <Link
                    key={item.label}
                    href={item.hrefColapsado}
                    className={`flex items-center gap-3 h-9 rounded-md text-sm transition-colors lg:justify-center lg:px-0 lg:border-l-0 ${algumFilhoAtivo
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-l-2 border-[var(--d1)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    title={item.label}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                  </Link>
                )
              }

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleGrupo(item.label)}
                    className={`w-full flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors ${algumFilhoAtivo
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-l-2 border-[var(--d1)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-150 ${aberto ? 'rotate-180' : ''}`} />
                  </button>
                  {aberto && (
                    <div className="mt-0.5 ml-[34px] space-y-0.5 border-l border-[var(--border)] pl-2.5">
                      {item.children.map((child) => {
                        const childAtivo = pathname.startsWith(child.href)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center h-8 px-2.5 rounded-md text-sm transition-colors ${childAtivo
                              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                              }`}
                          >
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const link = item
            const Icon = link.icon
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 h-9 rounded-md text-sm transition-colors ${isActive
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
            className={`flex items-center gap-2 h-9 rounded-md text-sm font-medium text-white transition-colors hover:brightness-110 ${collapsed ? 'lg:justify-center lg:px-0' : 'px-3'
              }`}
            style={{ backgroundColor: 'var(--d1)' }}
            title={collapsed ? 'Novo D1' : undefined}
          >
            <Plus size={18} />
            {!collapsed && <span>Novo </span>}
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
