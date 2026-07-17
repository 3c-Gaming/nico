import type { Disparo } from '@/types'

export interface ResultadoCasa {
  registros: number
  ftds: number
  cpas: number
}

interface ExportItem {
  acid?: string
  marketing_source_id?: string
  registrations?: number
  ftds?: number
  cpa?: number
  [key: string]: unknown
}

export async function sincronizarResultados(
  disparos: Disparo[],
  date?: string,
): Promise<Record<string, ResultadoCasa>> {
  const comTracking = disparos.filter((d) => d.utm || d.betmgmPid)
  if (!comTracking.length) return {}

  const dataParaBusca = date ?? new Date().toISOString().split('T')[0]
  const params = new URLSearchParams({ date: dataParaBusca })

  const res = await fetch(
    `/api/casas/export?${params.toString()}`,
    { signal: AbortSignal.timeout(30_000) },
  )

  if (!res.ok) {
    throw new Error(`Erro ao buscar resultados das casas: ${res.status}`)
  }

  const data = await res.json()
  const result: Record<string, ResultadoCasa> = {}

  function ensure(id: string) {
    if (!result[id]) result[id] = { registros: 0, ftds: 0, cpas: 0 }
    return result[id]
  }

  const superbetData = data.superbet?.data as ExportItem[] | undefined
  if (Array.isArray(superbetData)) {
    for (const item of superbetData) {
      const acid = String(item.acid ?? '')
      if (!acid) continue
      const match = comTracking.find((d) => d.utm && acid.includes(d.utm))
      if (!match) continue
      const r = ensure(match.id)
      r.registros += item.registrations ?? 0
      r.ftds += item.ftds ?? 0
      r.cpas += item.cpa ?? 0
    }
  }

  const mgmData = data.mgm?.data as ExportItem[] | undefined
  if (Array.isArray(mgmData)) {
    for (const item of mgmData) {
      const pid = String(item.marketing_source_id ?? '')
      if (!pid) continue
      const match = comTracking.find((d) => d.betmgmPid === pid)
      if (!match) continue
      const r = ensure(match.id)
      r.registros += item.registrations ?? 0
      r.ftds += item.ftds ?? 0
      r.cpas += item.cpa ?? 0
    }
  }

  return result
}
