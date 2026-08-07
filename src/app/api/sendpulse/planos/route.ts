import { NextResponse } from 'next/server'
import { buscarStatusPlanoTodasContas } from '@/lib/integrações/sendpulse'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 6 * 60 * 60 * 1000

export async function GET() {
  try {
    const planos = await getOrFetch('sendpulse-planos', 'all', TTL_MS, () =>
      buscarStatusPlanoTodasContas(AbortSignal.timeout(15_000)),
    )
    return NextResponse.json({ planos })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
