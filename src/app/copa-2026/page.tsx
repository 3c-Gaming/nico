'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { CopaTimeline } from '@/components/copa-2026/CopaTimeline'

export default function Copa2026Page() {
  return (
    <>
      <PageHeader
        titulo="Copa 2026"
        icon={
          <>
            <img
              src="/world-cup-dark.png"
              alt=""
              className="h-5 w-5 block dark:hidden"
            />
            <img
              src="/world-cup-white.png"
              alt=""
              className="h-5 w-5 hidden dark:block"
            />
          </>
        }
      />
      <CopaTimeline />
    </>
  )
}
