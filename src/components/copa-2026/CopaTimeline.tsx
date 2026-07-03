'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { CopaMatch } from '@/types'
import { isMesmaData, adicionarDias, gerarRangeDias, parsearDataISO } from '@/lib/datas'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { ColunaDataJogos } from './ColunaDataJogos'
import { CopaFiltros } from './CopaFiltros'
import { Button } from '../ui/Button'
import type { FiltrosCopaCalendario } from './CopaFiltros'

function primeiroDiaDoMes(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function ultimoDiaDoMes(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function nomeMes(date: Date): string {
  return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function gerarDatasMes(date: Date): string[] {
  const ano = date.getFullYear()
  const mes = date.getMonth()
  const total = new Date(ano, mes + 1, 0).getDate()
  const datas: string[] = []
  for (let d = 1; d <= total; d++) {
    datas.push(`${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return datas
}

export function CopaTimeline() {
  const hoje = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [])

  const [mesAtual, setMesAtual] = useState(() => primeiroDiaDoMes(hoje))
  const [matches, setMatches] = useState<CopaMatch[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const [filtros, setFiltrosState] = useState<FiltrosCopaCalendario>({
    stages: [],
    grupos: [],
    apenasAoVivo: false,
  })

  const diaInicio = mesAtual
  const diaFim = useMemo(() => adicionarDias(primeiroDiaDoMes(mesAtual), ultimoDiaDoMes(mesAtual) - 1), [mesAtual])

  const diasVisiveis = useMemo(() => gerarRangeDias(diaInicio, diaFim), [diaInicio, diaFim])

  useEffect(() => {
    let cancelled = false
    async function carregar() {
      setLoading(true)
      try {
        const dates = gerarDatasMes(mesAtual)
        const results = await Promise.allSettled(
          dates.map((d) =>
            fetch(`/api/copa-2026/fixtures?date=${d}`)
              .then((r) => (r.ok ? r.json() : { matches: [] }))
              .then((j) => (j.matches ?? []) as CopaMatch[])
          )
        )
        if (cancelled) return
        const todos: CopaMatch[] = []
        for (const r of results) {
          if (r.status === 'fulfilled') todos.push(...r.value)
        }
        setMatches(todos)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    carregar()
    return () => { cancelled = true }
  }, [mesAtual])

  const matchesFiltrados = useMemo(() => {
    return matches.filter((m) => {
      if (filtros.stages.length > 0 && !filtros.stages.includes(m.stage))
        return false
      if (filtros.grupos.length > 0 && !filtros.grupos.includes(m.group ?? ''))
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

  const stagesDisponiveis = useMemo(() => [...new Set(matches.map((m) => m.stage))], [matches])
  const gruposDisponiveis = useMemo(() => [...new Set(matches.map((m) => m.group).filter(Boolean) as string[])], [matches])

  const indexHoje = useMemo(
    () => diasVisiveis.findIndex((d) => isMesmaData(d, hoje)),
    [diasVisiveis, hoje]
  )

  useEffect(() => {
    if (indexHoje >= 0 && containerRef.current) {
      const coluna = containerRef.current.querySelector(`[data-dia-index="${indexHoje}"]`)
      if (coluna) {
        setTimeout(() => {
          coluna.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }, 100)
      }
    }
  }, [indexHoje, loading])

  function avancarMes() {
    setMesAtual((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function recuarMes() {
    setMesAtual((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function irParaHoje() {
    setMesAtual(primeiroDiaDoMes(hoje))
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <CopaFiltros
            filtros={filtros}
            onChange={setFiltros}
            stages={stagesDisponiveis}
            grupos={gruposDisponiveis}
          />
          {loading && <RefreshCw size={14} className="animate-spin text-[var(--text-muted)]" />}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={recuarMes} icon={<ChevronLeft size={16} />}>
            Anterior
          </Button>
          <span className="text-sm font-medium text-[var(--text-primary)] capitalize min-w-[150px] text-center select-none">
            {nomeMes(mesAtual)}
          </span>
          <Button variant="ghost" size="sm" onClick={avancarMes} icon={<ChevronRight size={16} />}>
            Próximo
          </Button>
          <Button variant="secondary" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex min-h-full">
          {diasVisiveis.map((data, index) => (
            <ColunaDataJogos
              key={data.toISOString()}
              data={data}
              hoje={hoje}
              matches={matchesPorDia.get(data.toISOString().split('T')[0]) ?? []}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
