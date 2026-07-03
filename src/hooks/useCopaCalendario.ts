'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import type { CopaMatch } from '@/types'
import { gerarRangeDias, isMesmaData, adicionarDias, parsearDataISO } from '@/lib/datas'

export interface FiltrosCopaCalendario {
  stages: string[]
  grupos: string[]
  apenasAoVivo: boolean
}

const DIAS_ANTES = 1
const DIAS_DEPOIS = 16

export function useCopaCalendario(matches: CopaMatch[]) {
  const [hoje] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  })

  const [inicioRange, setInicioRange] = useState(() => adicionarDias(hoje, -DIAS_ANTES))
  const containerRef = useRef<HTMLDivElement>(null)

  const [filtros, setFiltrosState] = useState<FiltrosCopaCalendario>({
    stages: [],
    grupos: [],
    apenasAoVivo: false,
  })

  const fimRange = useMemo(() => adicionarDias(inicioRange, DIAS_ANTES + DIAS_DEPOIS), [inicioRange])

  const diasVisiveis = useMemo(() => gerarRangeDias(inicioRange, fimRange), [inicioRange, fimRange])

  const matchesFiltrados = useMemo(() => {
    return matches.filter((m) => {
      if (filtros.stages.length > 0 && !filtros.stages.includes(m.stage))
        return false
      if (filtros.grupos.length > 0 && !filtros.grupos.includes(m.group ?? ''))
        return false
      if (filtros.apenasAoVivo && m.status !== 'scheduled')
        return false
      return true
    })
  }, [matches, filtros])

  const matchesPorDia = useMemo(() => {
    const map = new Map<string, CopaMatch[]>()
    for (const dia of diasVisiveis) {
      const key = dia.toISOString().split('T')[0]
      const doDia = matchesFiltrados.filter((m) => {
        const dataJogo = parsearDataISO(m.date)
        return isMesmaData(dataJogo, dia)
      })
      if (doDia.length > 0) map.set(key, doDia)
    }
    return map
  }, [diasVisiveis, matchesFiltrados])

  const setFiltros = useCallback((f: Partial<FiltrosCopaCalendario>) => {
    setFiltrosState((prev) => ({ ...prev, ...f }))
  }, [])

  const irParaHoje = useCallback(() => {
    const hojeIndex = diasVisiveis.findIndex((d) => isMesmaData(d, hoje))
    if (hojeIndex >= 0 && containerRef.current) {
      const coluna = containerRef.current.querySelector(`[data-dia-index="${hojeIndex}"]`)
      coluna?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [diasVisiveis, hoje])

  const avancar = useCallback(() => {
    setInicioRange((prev) => adicionarDias(prev, 7))
  }, [])

  const recuar = useCallback(() => {
    setInicioRange((prev) => adicionarDias(prev, -7))
  }, [])

  const stagesDisponiveis = useMemo(() => {
    return [...new Set(matchesFiltrados.map((m) => m.stage))]
  }, [matchesFiltrados])

  const gruposDisponiveis = useMemo(() => {
    return [...new Set(matchesFiltrados.map((m) => m.group).filter(Boolean))]
  }, [matchesFiltrados])

  return {
    diasVisiveis,
    hoje,
    matchesPorDia,
    filtros,
    setFiltros,
    irParaHoje,
    avancar,
    recuar,
    containerRef,
    stagesDisponiveis,
    gruposDisponiveis,
  }
}
