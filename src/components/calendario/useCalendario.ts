'use client'

import { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react'
import type { Disparo, TipoDisparo, StatusDisparo, ItemCalendario, DisparoDaxx, DisparoAgendadoDaxx } from '@/types'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useEtapaConfigs } from '@/hooks/useEtapaConfigs'
import { gerarRangeDias, isMesmaData, adicionarDias } from '@/lib/datas'
import { parsearNomeCampanhaDaxx, casaPadraoPorTipo, dataCriacaoDaxxParaIso } from '@/lib/daxx-parser'
import { DEFAULT_CONFIGS } from '@/lib/esteira'

export interface FiltrosCalendario {
  casas: string[]
  tipos: TipoDisparo[]
  status: StatusDisparo[]
  apenasEsteiras: boolean
  mostrarDaxx: boolean
}

const ORDEM_TIPO: Record<string, number> = { PONTUAL: 0, D1: 1, D3: 2, D5: 3, D7: 4 }

const DIAS_ANTES = 3
const DIAS_DEPOIS = 14
const EXPANSAO_HISTORICO = 14
const LIMIAR_SCROLL_PX = 400
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

  // inicioRange e fimRange só crescem pra fora (nunca encolhem) — janela expansível, não
  // deslizante. Assim os dias já vistos (histórico) nunca somem enquanto o calendário
  // continua montado, e "hoje" nunca sai da visão só por causa da navegação.
  const [inicioRange, setInicioRange] = useState(() => adicionarDias(hoje, -DIAS_ANTES))
  const [fimRange, setFimRange] = useState(() => adicionarDias(hoje, DIAS_DEPOIS))
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollWidthAntesExpansaoRef = useRef<number | null>(null)
  const expandindoRef = useRef(false)

  const [filtros, setFiltrosState] = useState<FiltrosCalendario>(() => ({
    casas: [],
    tipos: [],
    status: [],
    apenasEsteiras: false,
    mostrarDaxx: isBrowser() ? localStorage.getItem(MOSTRAR_DAXX_KEY) !== 'false' : true,
  }))

  const { list: todosDisparos } = useDisparos()
  const { casas, list: casasList } = useCasasAposta()
  const { configs: etapaConfigsRaw } = useEtapaConfigs()

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

        if (d.daxxCampanhaId) {
          const campanha = daxxPorTemplateId.get(d.daxxCampanhaId)
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
          if (d.daxxCampanhaId) vinculados.add(d.daxxCampanhaId)
        }

        for (const campanha of campanhasDaxx) {
          if (vinculados.has(campanha.id)) continue

          const parsed = parsearNomeCampanhaDaxx(campanha.nome)
          // A data de verdade é a que a DAXX registrou (dataCriacao) — o nome é digitado à
          // mão e às vezes fica com data velha (copiado de um ciclo anterior sem atualizar),
          // o que fazia disparos de hoje sumirem do calendário.
          const dataReal = dataCriacaoDaxxParaIso(campanha.dataCriacao)
          if (!dataReal) continue
          if (dataReal !== key) continue

          const casasAposta = casaPadraoPorTipo(parsed.tipo, casasList)

          if (filtros.tipos.length > 0 && !filtros.tipos.includes(parsed.tipo)) continue
          if (filtros.casas.length > 0 && !casasAposta.some((c) => filtros.casas.includes(c))) continue

          itens.push({
            id: `daxx_${campanha.id}`,
            tipo: parsed.tipo,
            nome: campanha.nome,
            nomenclatura: campanha.nome,
            dataDisparo: key,
            casasAposta,
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

      if (itens.length > 0) {
        itens.sort((a, b) => (ORDEM_TIPO[a.tipo] ?? 99) - (ORDEM_TIPO[b.tipo] ?? 99))
        map.set(key, itens)
      }
    }

    // Projeta D3/D5/D7 futuros a partir de disparos reais já visíveis (D1, ou qualquer
    // etapa conhecida), usando os mesmos offsets da esteira. Some sozinho quando a
    // campanha real correspondente aparecer na DAXX (mesmo dia + tipo + rótulo da base).
    if (filtros.mostrarDaxx) {
      const configs = (etapaConfigsRaw && etapaConfigsRaw.length > 0) ? etapaConfigsRaw : DEFAULT_CONFIGS
      const offsetPorTipo: Record<string, number> = {}
      for (const c of configs) offsetPorTipo[c.tipo] = c.offsetDias

      const rotuloBase = (nome: string): string | null => {
        const baseNome = parsearNomeCampanhaDaxx(nome).baseNome
        return baseNome ? baseNome.trim().toLowerCase() : null
      }

      const jaProjetado = new Set<string>()

      for (const [, itensDoDia] of map) {
        for (const item of [...itensDoDia]) {
          if (item.fonte !== 'daxx' && item.fonte !== 'local') continue
          const offsetAtual = offsetPorTipo[item.tipo]
          if (offsetAtual == null) continue

          const label = rotuloBase(item.nome)
          if (!label) continue

          const dataAtual = new Date(item.dataDisparo + 'T00:00:00')
          const dataAncora = adicionarDias(dataAtual, -offsetAtual)

          for (const [tipoFuturo, offsetFuturo] of Object.entries(offsetPorTipo)) {
            if (offsetFuturo <= offsetAtual) continue

            const dataProjetada = adicionarDias(dataAncora, offsetFuturo)
            if (!diasVisiveis.some((d) => isMesmaData(d, dataProjetada))) continue
            const keyProjetada = dataProjetada.toISOString().split('T')[0]

            const dedupKey = `${keyProjetada}::${tipoFuturo}::${label}`
            if (jaProjetado.has(dedupKey)) continue

            const itensDoDiaAlvo = map.get(keyProjetada) ?? []
            const jaExisteReal = itensDoDiaAlvo.some((it) =>
              (it.fonte === 'daxx' || it.fonte === 'local') && it.tipo === tipoFuturo && rotuloBase(it.nome) === label,
            )
            if (jaExisteReal) continue

            const casasProjetadas = casaPadraoPorTipo(tipoFuturo as TipoDisparo, casasList)
            if (filtros.tipos.length > 0 && !filtros.tipos.includes(tipoFuturo as TipoDisparo)) continue
            if (filtros.casas.length > 0 && !casasProjetadas.some((c) => filtros.casas.includes(c))) continue

            jaProjetado.add(dedupKey)

            const itemProjetado: ItemCalendario = {
              id: `projetado_${label.replace(/\s+/g, '_')}_${tipoFuturo}_${keyProjetada}`,
              tipo: tipoFuturo as TipoDisparo,
              nome: label.toUpperCase(),
              nomenclatura: label.toUpperCase(),
              dataDisparo: keyProjetada,
              casasAposta: casasProjetadas,
              status: 'projetado',
              fonte: 'projetado',
            }

            const listaAlvo = map.get(keyProjetada)
            if (listaAlvo) listaAlvo.push(itemProjetado)
            else map.set(keyProjetada, [itemProjetado])
          }
        }
      }

      for (const [, lista] of map) {
        lista.sort((a, b) => (ORDEM_TIPO[a.tipo] ?? 99) - (ORDEM_TIPO[b.tipo] ?? 99))
      }
    }

    return map
  }, [diasVisiveis, disparosLocais, todosDisparos, campanhasDaxx, agendadosDaxx, filtros, casas, casasList, etapaConfigsRaw])

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

  // Expande a janela pra trás (mais dias de histórico) sem perder a posição visual de
  // scroll — guarda a largura de antes e compensa depois que as colunas novas entram.
  const expandirHistorico = useCallback(() => {
    if (expandindoRef.current) return
    expandindoRef.current = true
    if (containerRef.current) {
      scrollWidthAntesExpansaoRef.current = containerRef.current.scrollWidth
    }
    setInicioRange((prev) => adicionarDias(prev, -EXPANSAO_HISTORICO))
  }, [])

  useLayoutEffect(() => {
    if (scrollWidthAntesExpansaoRef.current == null || !containerRef.current) return
    const delta = containerRef.current.scrollWidth - scrollWidthAntesExpansaoRef.current
    containerRef.current.scrollLeft += delta
    scrollWidthAntesExpansaoRef.current = null
    expandindoRef.current = false
  }, [diasVisiveis])

  // Rola perto do início (esquerda) do calendário → carrega mais dias anteriores sozinho,
  // tipo scroll infinito. Continua funcionando enquanto o usuário for rolando pra trás.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleScroll = () => {
      if (el.scrollLeft < LIMIAR_SCROLL_PX) expandirHistorico()
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [expandirHistorico])

  const avancar = useCallback(() => {
    setFimRange((prev) => adicionarDias(prev, 7))
  }, [])

  const recuar = useCallback(() => {
    expandirHistorico()
  }, [expandirHistorico])

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
