'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { DataInitializer } from '@/components/DataInitializer'
import { AlertaPlanosSendpulse } from '@/components/sendpulse/AlertaPlanosSendpulse'

function isTelaCheia(pathname: string): boolean {
  return pathname.startsWith('/r/') || pathname.startsWith('/funis/apresentar') || /^\/resultados\/[^/]+\/apresentar/.test(pathname)
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
          <div className="flex flex-col h-full">
            <AlertaPlanosSendpulse />
            <div className="flex flex-1 min-h-0">
              <Sidebar />
              <main className="flex justify-center w-full overflow-y-auto bg-[var(--bg-base)] lg:ml-0">
               <div className='w-full p-4'>
                {children}
                </div>
              </main>
            </div>
          </div>
        )}
      </ToastProvider>
    </ThemeProvider>
  )
}
