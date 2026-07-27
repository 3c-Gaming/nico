import { NextRequest, NextResponse } from 'next/server'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

/**
 * Busca registros/FTDs/CPAs de um ACID direto no painel de afiliados da Superbet
 * (scraping via daxx-bridge), em vez do export da Railway. Mais lento (Playwright real),
 * mas puxa direto da fonte.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const acid = searchParams.get('acid')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate') ?? startDate

  if (!acid || !startDate) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios: acid, startDate (endDate opcional)' },
      { status: 400 },
    )
  }

  try {
    const res = await fetch(
      `${BRIDGE_URL}/superbet/acid?acid=${encodeURIComponent(acid)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate ?? startDate)}`,
      { signal: AbortSignal.timeout(60_000), headers: { Accept: 'application/json' } },
    )
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? `Bridge Superbet: ${res.status}` }, { status: 502 })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
