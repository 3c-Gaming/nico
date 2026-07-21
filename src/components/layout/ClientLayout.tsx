'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { DataInitializer } from '@/components/DataInitializer'

function isTelaCheia(pathname: string): boolean {
  return pathname.startsWith('/r/') || /^\/resultados\/[^/]+\/apresentar/.test(pathname)
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const semSidebar = isTelaCheia(pathname)

  return (
    <ThemeProvider>
      <ToastProvider>
        <DataInitializer />
        {semSidebar ? (
          <main className="h-full overflow-y-auto bg-[var(--bg-base)]">{children}</main>
        ) : (
          <div className="flex h-full">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-y-auto bg-[var(--bg-base)] lg:ml-0">
              {children}
            </main>
          </div>
        )}
      </ToastProvider>
    </ThemeProvider>
  )
}
