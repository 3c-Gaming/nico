import { NextResponse } from 'next/server'
import { listarNumerosTodasContas } from '@/lib/integrações/sendpulse'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 5 * 60_000

export async function GET() {
  try {
    const numeros = await getOrFetch('numeros', 'all', TTL_MS, () =>
      listarNumerosTodasContas(AbortSignal.timeout(15_000))
    )
    return NextResponse.json({ numeros })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
