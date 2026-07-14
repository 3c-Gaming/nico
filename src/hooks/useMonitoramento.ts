'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { DadosMonitoramento, StatusInteracao } from '@/types'

export const POLL_INTERVAL = 30_000
const STORAGE_KEY = 'nico_monitoramento_cache'

interface BotTestApiResult {
  botId: string
  status: string
  pendente?: boolean
  ultimoTesteOkMs?: number
  ultimoTriggerOkMs?: number
  ultimoTeste?: string
  erro?: string
  nome?: string
  duracaoMs?: number
}

function dentroDosUltimos30Min(ms: number | undefined): boolean {
  return !!ms && (Date.now() - ms) < 30 * 60 * 1000
}

function enriquecer(json: DadosMonitoramento, botTestResults?: BotTestApiResult[]): DadosMonitoramento {
  const botTestMap = new Map<string, BotTestApiResult>()
  if (botTestResults) {
    for (const r of botTestResults) {
      botTestMap.set(r.botId, r)
    }
  }

  const numeros = json.numeros.map((n) => {
    let status: StatusInteracao
    const botInfo = n.numero?.id ? botTestMap.get(n.numero.id) : undefined
    const isPendente = botInfo?.pendente === true

    if (botInfo?.status === 'ok') {
      status = 'respondendo'
    } else if ((botInfo?.status === 'sem_resposta' || botInfo?.status === 'erro') && !isPendente) {
      status = 'numero_caido'
    } else {
      if (dentroDosUltimos30Min(botInfo?.ultimoTesteOkMs) ||
          dentroDosUltimos30Min(botInfo?.ultimoTriggerOkMs) ||
          dentroDosUltimos30Min(n.ultimoAumentoMs)) {
        status = 'respondendo'
      } else {
        status = 'numero_caido'
      }
    }
    return { ...n, statusInteracao: status }
  })
  return { ...json, numeros }
}

export function useMonitoramento() {
  const [data, setData] = useState<DadosMonitoramento | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [proximaAtualizacao, setProximaAtualizacao] = useState(POLL_INTERVAL / 1000)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const fetchedRef = useRef(false)
  const botTestCacheRef = useRef<BotTestApiResult[]>([])

  const fetchData = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setRefreshing(true)
      setError(null)

      const [monitoramentoRes, botTestRes] = await Promise.all([
        fetch('/api/sendpulse/live-chat', { signal: controller.signal }),
        fetch('/api/bot-test/resultados', { signal: controller.signal }).catch(() => null),
      ])

      if (!mountedRef.current) return

      if (!monitoramentoRes.ok) throw new Error(`Erro ${monitoramentoRes.status}`)
      const json = await monitoramentoRes.json()

      let botTestResults: BotTestApiResult[] = []
      if (botTestRes && botTestRes.ok) {
        const botTestJson = await botTestRes.json()
        botTestResults = botTestJson.resultados ?? []
        botTestCacheRef.current = botTestResults
      } else {
        botTestResults = botTestCacheRef.current
      }

      if (!mountedRef.current) return

      const atualizado = enriquecer(json, botTestResults)
      setData(atualizado)
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizado)) } catch {}
      }
      setProximaAtualizacao(POLL_INTERVAL / 1000)
      setRefreshing(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') { setRefreshing(false); return }
      if (mountedRef.current) setError((err as Error).message)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!fetchedRef.current) {
      fetchedRef.current = true
      const cache = typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null
      if (cache) {
        try {
          const parsed = JSON.parse(cache) as DadosMonitoramento
          setData(enriquecer(parsed))
        } catch {}
      }
      fetchData()
    }
    const interval = setInterval(fetchData, POLL_INTERVAL)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => {
      setProximaAtualizacao((p) => Math.max(0, p - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const botTestMap = useMemo(() => new Map(botTestCacheRef.current.map(r => [r.botId, r])), [botTestCacheRef.current])

  return { data, loading: data === null, refreshing, error, atualizar: fetchData, proximaAtualizacao, botTestResults: botTestCacheRef.current, botTestMap }
}
