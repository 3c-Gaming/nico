'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DadosMonitoramento, StatusInteracao } from '@/types'

export const POLL_INTERVAL = 30_000
const STORAGE_KEY = 'nico_monitoramento_cache'

function enriquecer(json: DadosMonitoramento): DadosMonitoramento {
  const agora = Date.now()
  const numeros = json.numeros.map((n) => {
    let status: StatusInteracao
    const aumento = n.ultimoAumentoMs
    if (aumento && (agora - aumento) < 5 * 60 * 1000) status = 'respondendo'
    else if (aumento && (agora - aumento) < 30 * 60 * 1000) status = 'ocioso'
    else status = 'parado'
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

  const fetchData = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setRefreshing(true)
      setError(null)

      const res = await fetch('/api/sendpulse/live-chat', { signal: controller.signal })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()

      if (!mountedRef.current) return

      const atualizado = enriquecer(json)
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

  return { data, loading: data === null, refreshing, error, atualizar: fetchData, proximaAtualizacao }
}
