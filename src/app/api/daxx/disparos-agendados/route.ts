import { NextResponse } from 'next/server'
import { listarDisparosAgendados } from '@/lib/integrações/daxx'

export async function GET(request: Request) {
  try {
    const token = request.headers.get('x-daxx-token') ?? process.env.DAXX_API_KEY
    if (!token) {
      return NextResponse.json({ error: 'Token daxX não configurado. Acesse Configurações para definir.' }, { status: 401 })
    }
    const disparos = await listarDisparosAgendados(token)
    return NextResponse.json({ disparos })
  } catch (err) {
    console.error('[api/daxx]', err)
    const msg = (err as Error).message
    if (msg.includes('Token daxX') || msg.includes('expirado')) {
      return NextResponse.json({ error: msg }, { status: 401 })
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
