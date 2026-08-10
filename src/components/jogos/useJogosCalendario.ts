'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { Jogo } from '@/types'
import { gerarRangeDias, adicionarDias, isMesmaData, formatarData } from '@/lib/datas'

const DIAS_ANTES = 2
const DIAS_DEPOIS = 13

function chaveDia(d: Date): string {
  return formatarData(d, 'YYYY-MM-DD')
}

export function useJogosCalendario() {
  const [hoje] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  })
  const [referencia, setReferencia] = useState(hoje)
  const [jogosPorDia, setJogosPorDia] = useState<Map<string, Jogo[]>>(new Map())
  const [diasBloqueados, setDiasBloqueados] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ligasSelecionadas, setLigasSelecionadas] = useState<number[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const diasVisiveis = useMemo(
    () => gerarRangeDias(adicionarDias(referencia, -DIAS_ANTES), adicionarDias(referencia, DIAS_DEPOIS)),
    [referencia],
  )

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const resultados = await Promise.allSettled(
          diasVisiveis.map(async (dia) => {
            const key = chaveDia(dia)
            const res = await fetch(`/api/jogos/fixtures?date=${key}`)
            if (!res.ok) throw new Error('Erro ao buscar jogos')
            const json = await res.json()
            return { key, jogos: (json.jogos ?? []) as Jogo[], bloqueado: !!json.bloqueadoPeloPlano }
          }),
        )
        if (cancelado) return

        const mapa = new Map<string, Jogo[]>()
        const bloqueados = new Set<string>()
        let algumErro = false
        for (const r of resultados) {
          if (r.status === 'fulfilled') {
            mapa.set(r.value.key, r.value.jogos)
            if (r.value.bloqueado) bloqueados.add(r.value.key)
          } else {
            algumErro = true
          }
        }
        setJogosPorDia(mapa)
        setDiasBloqueados(bloqueados)
        if (algumErro) setErro('Alguns dias não carregaram — tente recarregar')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [diasVisiveis])

  const jogosPorDiaFiltrado = useMemo(() => {
    if (!ligasSelecionadas.length) return jogosPorDia
    const mapa = new Map<string, Jogo[]>()
    for (const [key, jogos] of jogosPorDia) {
      mapa.set(key, jogos.filter((j) => ligasSelecionadas.includes(j.ligaId)))
    }
    return mapa
  }, [jogosPorDia, ligasSelecionadas])

  const indexHoje = useMemo(() => diasVisiveis.findIndex((d) => isMesmaData(d, hoje)), [diasVisiveis, hoje])

  useEffect(() => {
    if (indexHoje >= 0 && containerRef.current) {
      const coluna = containerRef.current.querySelector(`[data-dia-index="${indexHoje}"]`)
      if (coluna) {
        setTimeout(() => {
          coluna.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }, 100)
      }
    }
  }, [indexHoje, carregando])

  const avancar = useCallback(() => setReferencia((prev) => adicionarDias(prev, 7)), [])
  const recuar = useCallback(() => setReferencia((prev) => adicionarDias(prev, -7)), [])
  const irParaHoje = useCallback(() => setReferencia(hoje), [hoje])

  return {
    hoje,
    diasVisiveis,
    jogosPorDia: jogosPorDiaFiltrado,
    diasBloqueados,
    carregando,
    erro,
    ligasSelecionadas,
    setLigasSelecionadas,
    avancar,
    recuar,
    irParaHoje,
    containerRef,
    chaveDia,
  }
}
