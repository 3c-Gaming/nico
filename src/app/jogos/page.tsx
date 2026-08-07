'use client'

import { LandPlot } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JogosTimeline } from '@/components/jogos/JogosTimeline'

export default function JogosPage() {
  return (
    <>
      <PageHeader
        titulo="Jogos"
        descricao="Brasileirão, Copa do Brasil, Libertadores, Sul-Americana, Champions, La Liga e Premier League"
        icon={<LandPlot size={20} />}
      />
      <JogosTimeline />
    </>
  )
}
