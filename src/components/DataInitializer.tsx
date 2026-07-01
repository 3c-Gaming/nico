'use client'

import { useEffect } from 'react'
import { getState, setState } from '@/lib/store'

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function arrayToRecord(arr: any[], key: string): Record<string, any> {
  const record: Record<string, any> = {}
  if (!arr) return record
  for (const item of arr) {
    const converted: any = {}
    for (const [k, v] of Object.entries(item)) {
      converted[snakeToCamel(k)] = v
    }
    const k = converted[key]
    if (typeof k === 'string' || typeof k === 'number') {
      record[String(k)] = converted
    }
  }
  return record
}

export function DataInitializer() {
  useEffect(() => {
    let cancel = false

    async function load() {
      const state = getState()

      const [disparosRes, esteirasRes, casasRes, templatesRes, configsRes] = await Promise.all([
        fetch('/api/disparos'),
        fetch('/api/esteiras'),
        fetch('/api/casas'),
        fetch('/api/link-templates'),
        fetch('/api/flow-tag-configs'),
      ])

      if (cancel) return

      const [disparosData, esteirasData, casasData, templatesData, configsData] = await Promise.all([
        disparosRes.json(),
        esteirasRes.json(),
        casasRes.json(),
        templatesRes.json(),
        configsRes.json(),
      ])

      const novosDisparos = arrayToRecord(disparosData.disparos ?? [], 'id')
      const novasEsteiras = arrayToRecord(esteirasData.esteiras ?? [], 'id')
      const novasCasas = arrayToRecord(casasData.casas ?? [], 'id')
      const novosTemplates = arrayToRecord(templatesData.templates ?? [], 'id')
      const novosConfigs = arrayToRecord(configsData.configs ?? [], 'flowId')

      const merged = {
        ...state,
        disparos: { ...state.disparos, ...novosDisparos },
        esteiras: { ...state.esteiras, ...novasEsteiras },
        casasAposta: { ...state.casasAposta, ...novasCasas },
        linkTemplates: { ...state.linkTemplates, ...novosTemplates },
        flowTagConfigs: { ...state.flowTagConfigs, ...novosConfigs },
        ultimaSync: new Date().toISOString(),
      }

      setState(merged)
      window.dispatchEvent(new CustomEvent('nico:data-loaded'))
    }

    load()

    return () => { cancel = true }
  }, [])

  return null
}
