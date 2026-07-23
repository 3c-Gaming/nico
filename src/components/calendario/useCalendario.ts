'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { Disparo, TipoDisparo, StatusDisparo, ItemCalendario, DisparoDaxx, DisparoAgendadoDaxx } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { gerarRangeDias, isMesmaData, adicionarDias } from '@/lib/datas'
import { parsearNomeCampanhaDaxx } from '@/lib/daxx-parser'

export interface FiltrosCalendario {
  casas: string[]
  tipos: TipoDisparo[]
  status: StatusDisparo[]
  apenasEsteiras: boolean
  mostrarDaxx: boolean
}

const DIAS_ANTES = 3
const DIAS_DEPOIS = 14
const DAXX_CACHE_KEY = 'daxx-campanhas-calendar'
const DAXX_CACHE_TS_KEY = 'daxx-campanhas-calendar-ts'
const DAXX_CACHE_TTL = 5 * 60 * 1000
const MOSTRAR_DAXX_KEY = 'calendario-mostrar-daxx'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function carregarCacheDaxx(): DisparoDaxx[] | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(DAXX_CACHE_KEY)
    const ts = localStorage.getItem(DAXX_CACHE_TS_KEY)
    if (!raw || !ts) return null
    if (Date.now() - Number(ts) > DAXX_CACHE_TTL) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function salvarCacheDaxx(data: DisparoDaxx[]) {
  if (!isBrowser()) return
  try {
    localStorage.setItem(DAXX_CACHE_KEY, JSON.stringify(data))
    localStorage.setItem(DAXX_CACHE_TS_KEY, String(Date.now()))
  } catch {}
}

export function useCalendario() {
  const [hoje] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  })

  const [inicioRange, setInicioRange] = useState(() => adicionarDias(hoje, -DIAS_ANTES))
  const containerRef = useRef<HTMLDivElement>(null)

  const [filtros, setFiltrosState] = useState<FiltrosCalendario>(() => ({
    casas: [],
    tipos: [],
    status: [],
    apenasEsteiras: false,
    mostrarDaxx: isBrowser() ? localStorage.getItem(MOSTRAR_DAXX_KEY) !== 'false' : true,
  }))

  const { list: todosDisparos } = useDisparos()
  const { casas } = useCasasAposta()

  const [campanhasDaxx, setCampanhasDaxx] = useState<DisparoDaxx[]>([])
  const [agendadosDaxx, setAgendadosDaxx] = useState<DisparoAgendadoDaxx[]>([])

  useEffect(() => {
    const cache = carregarCacheDaxx()
    if (cache) setCampanhasDaxx(cache)

    fetch('/api/daxx/campanhas')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.campanhas) {
          setCampanhasDaxx(data.campanhas)
          salvarCacheDaxx(data.campanhas)
        }
      })
      .catch(() => {})

    const token = localStorage.getItem('nico_daxx_token')
    if (token) {
      fetch('/api/daxx/disparos-agendados', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (Array.isArray(data)) setAgendadosDaxx(data)
        })
        .catch(() => {})
    }
  }, [])

  const fimRange = useMemo(() => adicionarDias(inicioRange, DIAS_ANTES + DIAS_DEPOIS), [inicioRange])

  const diasVisiveis = useMemo(() => gerarRangeDias(inicioRange, fimRange), [inicioRange, fimRange])

  const disparosLocais = useMemo(() => {
    return todosDisparos.filter((d) => {
      if (filtros.casas.length > 0 && !d.casasAposta.some((c) => filtros.casas.includes(c))) return false
      if (filtros.tipos.length > 0 && !filtros.tipos.includes(d.tipo)) return false
      if (filtros.status.length > 0 && !filtros.status.includes(d.status)) return false
      if (filtros.apenasEsteiras && !d.esteiraPaiId) return false
      return true
    })
  }, [todosDisparos, filtros])

  const disparosPorDia = useMemo(() => {
    const map = new Map<string, ItemCalendario[]>()
    const locaisPorId = new Map<string, Disparo>()
    for (const d of disparosLocais) locaisPorId.set(d.id, d)
    const daxxPorTemplateId = new Map<string, DisparoDaxx>()
    for (const c of campanhasDaxx) {
      if (c.id && !c.id.startsWith('fallback_')) daxxPorTemplateId.set(c.id, c)
    }

    for (const dia of diasVisiveis) {
      const key = dia.toISOString().split('T')[0]
      const itens: ItemCalendario[] = []

      for (const d of disparosLocais) {
        const dataDisparo = new Date(d.dataDisparo + 'T00:00:00')
        if (!isMesmaData(dataDisparo, dia)) continue

        let entregues: number | undefined
        let lidas: number | undefined
        let rejeitados: number | undefined
        let statusDaxx: string | undefined

        if (d.templateDaxx?.id) {
          const campanha = daxxPorTemplateId.get(d.templateDaxx.id)
          if (campanha) {
            entregues = campanha.entregues
            lidas = campanha.lidas
            rejeitados = campanha.rejeitados
            statusDaxx = campanha.status
          }
        }

        itens.push({
          id: d.id,
          tipo: d.tipo,
          nome: d.nomenclatura,
          nomenclatura: d.nomenclatura,
          dataDisparo: key,
          horarioDisparo: d.horarioDisparo,
          casasAposta: d.casasAposta,
          status: statusDaxx ?? d.status,
          fonte: 'local',
          entregues,
          lidas,
          rejeitados,
          totalBase: d.base.totalRegistros,
          disparoLocal: d,
        })
      }

      if (filtros.mostrarDaxx) {
        const vinculados = new Set<string>()
        for (const d of todosDisparos) {
          if (d.templateDaxx?.id) vinculados.add(d.templateDaxx.id)
        }

        for (const campanha of campanhasDaxx) {
          if (vinculados.has(campanha.id)) continue

          const parsed = parsearNomeCampanhaDaxx(campanha.nome)
          if (!parsed.dataDisparo) continue
          if (parsed.dataDisparo !== key) continue
          if (!parsed.tipo) continue

          if (filtros.tipos.length > 0 && !filtros.tipos.includes(parsed.tipo)) continue
          if (filtros.casas.length > 0 && parsed.casaSlug && !filtros.casas.includes(parsed.casaSlug)) continue

          itens.push({
            id: `daxx_${campanha.id}`,
            tipo: parsed.tipo,
            nome: campanha.nome,
            nomenclatura: campanha.nome,
            dataDisparo: key,
            casasAposta: parsed.casaSlug ? [parsed.casaSlug] : [],
            status: campanha.status,
            fonte: 'daxx',
            entregues: campanha.entregues,
            lidas: campanha.lidas,
            rejeitados: campanha.rejeitados,
            totalBase: campanha.totalBase,
            campanhaDaxx: campanha,
          })
        }

        for (const agendado of agendadosDaxx) {
          if (!agendado.agendado_para) continue
          const dataAgendada = agendado.agendado_para.slice(0, 10)
          if (dataAgendada !== key) continue

          const marcaNome = agendado.marcas?.nome ?? ''
          const isSuper = /super/i.test(marcaNome)
          const isMgm = /mgm|betmgm/i.test(marcaNome)
          const casaSlug = isSuper ? 'superbet' : isMgm ? 'betmgm' : ''

          if (filtros.casas.length > 0 && casaSlug && !filtros.casas.includes(casaSlug)) continue

          itens.push({
            id: `agendado_${agendado.id}`,
            tipo: 'PONTUAL',
            nome: `Agendado — ${marcaNome || 'DAXX'}`,
            nomenclatura: `Agendado — ${marcaNome || 'DAXX'}`,
            dataDisparo: key,
            casasAposta: casaSlug ? [casaSlug] : [],
            status: agendado.status,
            fonte: 'agendado',
            agendado,
          })
        }
      }

      if (itens.length > 0) map.set(key, itens)
    }

    return map
  }, [diasVisiveis, disparosLocais, todosDisparos, campanhasDaxx, agendadosDaxx, filtros, casas])

  const setFiltros = useCallback((f: Partial<FiltrosCalendario>) => {
    setFiltrosState((prev) => {
      const next = { ...prev, ...f }
      if (f.mostrarDaxx !== undefined) {
        localStorage.setItem(MOSTRAR_DAXX_KEY, String(f.mostrarDaxx))
      }
      return next
    })
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
