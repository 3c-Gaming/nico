import { NextResponse } from 'next/server'
import { analisarBaseCsv } from '@/lib/analiseBaseDaxx'

const BRIDGE_URL = process.env.NEXT_PUBLIC_DAXX_BRIDGE_URL || 'http://localhost:3334'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const res = await fetch(BRIDGE_URL + '/campanhas/' + encodeURIComponent(id) + '/base', {
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(txt || 'bridge error ' + res.status)
    }
    const csv = await res.text()
    const analise = analisarBaseCsv(csv)
    return NextResponse.json({ analise })
  } catch (err) {
    console.error('[api/daxx/base]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
