import type { PreferenciaCopa, SugestaoCopa } from '@/types'

const STORAGE_KEY = 'copa_2026_preferencias'

export function salvarPreferencia(sugestao: SugestaoCopa, stage: string): void {
  const lista = listarPreferencias()
  const nova: PreferenciaCopa = {
    id: crypto.randomUUID(),
    sugestaoId: sugestao.id,
    data: sugestao.data,
    createdAt: new Date().toISOString(),
    sugestao,
    stage,
  }
  lista.push(nova)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
}

export function listarPreferencias(): PreferenciaCopa[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function removerPreferencia(id: string): void {
  const lista = listarPreferencias().filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
}

export function limparPreferencias(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getResumoPreferencias(): string {
  const lista = listarPreferencias()
  if (!lista.length) return ''

  const entradas = lista.map((p) => {
    const times = p.sugestao.matches.map((m) => `${m.homeTeam} vs ${m.awayTeam}`).join(' + ')
    return `- "${p.sugestao.titulo}" (${times})`
  })

  return entradas.join('\n')
}
