import { NextResponse } from 'next/server'

// Monitoramento externo do blacksender-bridge (Render, plano pago — não hiberna, então isso não
// é keep-alive de verdade). O bug real que causou perda de leads no primeiro dia no ar foi uma
// conexão Realtime "zumbi" (WebSocket morre sem avisar o cliente, ver
// blacksender-bridge/src/realtimeListener.ts — mitigado lá com reconexão forçada periódica).
// Esse ping aqui só serve pra aparecer nos logs de cron da Vercel caso o bridge fique
// totalmente inacessível (crash, deploy quebrado).
export const maxDuration = 30

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const bridgeUrl = process.env.BLACKSENDER_BRIDGE_URL
  if (!bridgeUrl) {
    return NextResponse.json({ erro: 'BLACKSENDER_BRIDGE_URL não configurado' }, { status: 500 })
  }

  try {
    const res = await fetch(`${bridgeUrl}/status`, { signal: AbortSignal.timeout(20_000) })
    const status = await res.json().catch(() => null)
    return NextResponse.json({ ok: res.ok, bridge: status })
  } catch (err) {
    console.error('[cron-blacksender-keepalive]', (err as Error).message)
    return NextResponse.json({ ok: false, erro: (err as Error).message }, { status: 502 })
  }
}
