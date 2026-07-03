import type { Disparo } from '@/types'

export interface CpaResultado {
  cpas: number
  registrations: number
  ftds: number
}

export function matchPidToDisparo(
  pid: string,
  bethouse: string,
  disparos: Disparo[],
): Disparo | null {
  if (bethouse === 'superbet') {
    return disparos.find((d) => d.utm && d.utm === pid) ?? null
  }
  if (bethouse === 'betmgm') {
    return disparos.find(
      (d) => d.betmgmPid && (d.betmgmPid === pid || String(d.betmgmPid) === pid),
    ) ?? null
  }
  return null
}

export function agregarCpaPorDisparo(
  results: { bethouse: string; pid: string; cpa: number; registrations: number; ftds: number }[],
  disparos: Disparo[],
): Record<string, CpaResultado> {
  const acc: Record<string, CpaResultado> = {}

  for (const r of results) {
    if (r.pid === 'unknown') continue
    const match = matchPidToDisparo(r.pid, r.bethouse, disparos)
    if (!match) continue

    if (!acc[match.id]) {
      acc[match.id] = { cpas: 0, registrations: 0, ftds: 0 }
    }

    acc[match.id].cpas += r.cpa
    acc[match.id].registrations += r.registrations
    acc[match.id].ftds += r.ftds
  }

  return acc
}

export async function sincronizarCpa(
  disparos: Disparo[],
  date?: string,
): Promise<Record<string, CpaResultado>> {
  const comCpa = disparos.filter((d) => d.utm || d.betmgmPid)
  if (!comCpa.length) return {}

  const params = new URLSearchParams()
  if (date) params.set('date', date)

  const res = await fetch(
    `/api/cpa/export${params.toString() ? `?${params.toString()}` : ''}`,
    { signal: AbortSignal.timeout(30_000) },
  )

  if (!res.ok) {
    throw new Error(`Erro ao buscar CPA: ${res.status}`)
  }

  const data = await res.json()
  const todos: { bethouse: string; pid: string; cpa: number; registrations: number; ftds: number }[] = []

  for (const casa of ['superbet', 'betmgm'] as const) {
    const d = data[casa]
    if (d?.data && Array.isArray(d.data)) {
      for (const item of d.data) {
        todos.push({
          bethouse: casa,
          pid: item.pid,
          cpa: item.cpa,
          registrations: item.registrations,
          ftds: item.ftds,
        })
      }
    }
  }

  return agregarCpaPorDisparo(todos, disparos)
}
