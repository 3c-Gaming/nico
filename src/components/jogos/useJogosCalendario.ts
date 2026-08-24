'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { Jogo } from '@/types'
import { gerarRangeDias, adicionarDias, isMesmaData, formatarData, dataParaBrasilISO } from '@/lib/datas'

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
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ligasSelecionadas, setLigasSelecionadas] = useState<number[]>([])
  const [filtroTime, setFiltroTime] = useState('')
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
        // Um único request pro intervalo inteiro (não um por dia) — a fonte atual (football-data.org)
        // aceita dateFrom/dateTo nativamente, e o plano gratuito tem limite de req/min que um
        // request por dia (até 16 de uma vez) estouraria na primeira carga. dateTo pede 2 dias de
        // folga a mais (confirmado ao vivo: dateTo=X exclui o dia X inteiro, não só o que vem
        // depois dele) — um jogo do último dia visível às 21h+ em Brasília (UTC-3) já é UTC do dia
        // seguinte, e esse dia só entra no resultado se dateTo for 2 dias depois dele. O
        // agrupamento por dataParaBrasilISO abaixo descarta o que sobrar fora de diasVisiveis.
        const dateFrom = chaveDia(diasVisiveis[0])
        const dateTo = chaveDia(adicionarDias(diasVisiveis[diasVisiveis.length - 1], 2))
        const res = await fetch(`/api/jogos/fixtures?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        if (!res.ok) throw new Error('Erro ao buscar jogos')
        const json = await res.json()
        const jogos = (json.jogos ?? []) as Jogo[]
        if (cancelado) return

        // Agrupa por dia em horário de Brasília (não UTC) — um jogo às 21h de Brasília em 23/08 é
        // 00h UTC de 24/08, cairia no dia errado se agrupasse pela data UTC crua.
        const mapa = new Map<string, Jogo[]>()
        for (const dia of diasVisiveis) mapa.set(chaveDia(dia), [])
        for (const jogo of jogos) {
          const key = dataParaBrasilISO(jogo.date)
          if (mapa.has(key)) mapa.get(key)!.push(jogo)
        }
        setJogosPorDia(mapa)
      } catch {
        if (!cancelado) setErro('Erro ao buscar jogos — tente recarregar')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [diasVisiveis])

  const jogosPorDiaFiltrado = useMemo(() => {
    const termo = filtroTime.trim().toLowerCase()
    if (!ligasSelecionadas.length && !termo) return jogosPorDia
    const mapa = new Map<string, Jogo[]>()
    for (const [key, jogos] of jogosPorDia) {
      mapa.set(key, jogos.filter((j) => {
        if (ligasSelecionadas.length && !ligasSelecionadas.includes(j.ligaId)) return false
        if (termo && !j.homeTeam.toLowerCase().includes(termo) && !j.awayTeam.toLowerCase().includes(termo)) return false
        return true
      }))
    }
    return mapa
  }, [jogosPorDia, ligasSelecionadas, filtroTime])

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
    carregando,
    erro,
    ligasSelecionadas,
    setLigasSelecionadas,
    filtroTime,
    setFiltroTime,
    avancar,
    recuar,
    irParaHoje,
    containerRef,
    chaveDia,
  }
}
