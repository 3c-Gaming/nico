'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-y-auto bg-[var(--bg-base)] lg:ml-0">
            {children}
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  )
}
