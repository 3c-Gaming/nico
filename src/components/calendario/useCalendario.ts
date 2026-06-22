'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import type { Disparo, TipoDisparo, StatusDisparo } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { gerarRangeDias, isMesmaData, adicionarDias, parsearDataISO } from '@/lib/datas'

export interface FiltrosCalendario {
  casas: string[]
  tipos: TipoDisparo[]
  status: StatusDisparo[]
  apenasEsteiras: boolean
}

const DIAS_ANTES = 3
const DIAS_DEPOIS = 14

export function useCalendario() {
  const [hoje] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  })

  const [inicioRange, setInicioRange] = useState(() => adicionarDias(hoje, -DIAS_ANTES))
  const containerRef = useRef<HTMLDivElement>(null)

  const [filtros, setFiltrosState] = useState<FiltrosCalendario>({
    casas: [],
    tipos: [],
    status: [],
    apenasEsteiras: false,
  })

  const { list: todosDisparos } = useDisparos()

  const fimRange = useMemo(() => adicionarDias(inicioRange, DIAS_ANTES + DIAS_DEPOIS), [inicioRange])

  const diasVisiveis = useMemo(() => gerarRangeDias(inicioRange, fimRange), [inicioRange, fimRange])

  const disparosFiltrados = useMemo(() => {
    return todosDisparos.filter((d) => {
      if (filtros.casas.length > 0 && !d.casasAposta.some((c) => filtros.casas.includes(c)))
        return false
      if (filtros.tipos.length > 0 && !filtros.tipos.includes(d.tipo))
        return false
      if (filtros.status.length > 0 && !filtros.status.includes(d.status))
        return false
      if (filtros.apenasEsteiras && !d.esteiraPaiId)
        return false
      return true
    })
  }, [todosDisparos, filtros])

  const disparosPorDia = useMemo(() => {
    const map = new Map<string, Disparo[]>()
    for (const dia of diasVisiveis) {
      const key = dia.toISOString().split('T')[0]
      const doDia = disparosFiltrados.filter((d) => {
        const dataDisparo = parsearDataISO(d.dataDisparo)
        return isMesmaData(dataDisparo, dia)
      })
      if (doDia.length > 0) map.set(key, doDia)
    }
    return map
  }, [diasVisiveis, disparosFiltrados])

  const setFiltros = useCallback((f: Partial<FiltrosCalendario>) => {
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

  return {
    diasVisiveis,
    hoje,
    disparosPorDia,
    filtros,
    setFiltros,
    irParaHoje,
    avancar,
    recuar,
    containerRef,
  }
}
