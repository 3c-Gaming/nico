import { NextResponse } from 'next/server'
import { getOrFetch } from '@/lib/cache'
import { parsearNomeCampanhaDaxx } from '@/lib/daxx-parser'
import { listarDisparosPilhado } from '@/lib/db/supabase'
import type { DisparoDaxx } from '@/types'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'
const TTL_MS = 5 * 60 * 1000
const STALE_MULTIPLIER = 6

/** Campanhas DAXX pontuais (sem D1/D3/D5/D7 no nome) com "PILHADO PREMIOS" no nome que ainda
 * não foram cadastradas como disparo_pilhado — pra popular o seletor de "novo disparo via DAXX". */
export async function GET() {
  try {
    const data = await getOrFetch('daxx', 'campanhas', TTL_MS, async () => {
      const res = await fetch(BRIDGE_URL + '/campanhas', { signal: AbortSignal.timeout(30000) })
      if (!res.ok) throw new Error((await res.text().catch(() => '')) || `bridge error ${res.status}`)
      const json = await res.json()
      if (!json.campanhas || !json.campanhas.length) throw new Error('bridge returned empty campaigns')
      return json
    }, STALE_MULTIPLIER)

    const campanhas = (data.campanhas ?? []) as DisparoDaxx[]
    const jaCadastradas = new Set(
      (await listarDisparosPilhado()).map((d) => d.daxxCampanhaId).filter(Boolean),
    )

    const disponiveis = campanhas.filter((c) => {
      if (jaCadastradas.has(c.id)) return false
      if (!c.nome.toUpperCase().includes('PILHADO PREMIOS')) return false
      return parsearNomeCampanhaDaxx(c.nome).tipo === 'PONTUAL'
    })

    return NextResponse.json({ campanhas: disponiveis })
  } catch (err) {
    console.error('[api/pilhado-premios/daxx-disponiveis]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message, campanhas: [] }, { status: 502 })
  }
}
