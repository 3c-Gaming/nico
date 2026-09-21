import { NextResponse } from 'next/server'

// O blacksender-bridge (Render, plano free) hiberna depois de ~15min sem tráfego HTTP — e como
// ele só recebe tráfego de entrada indiretamente (a conexão dele com o Supabase da Black Sender
// é de SAÍDA, não gera hit nenhum no Render), sem esse ping ele passa a maior parte do tempo
// dormindo com o WebSocket do Realtime morto, perdendo lead/tag/conversa que chegam nesse meio
// tempo (foi exatamente o que aconteceu no primeiro dia no ar — 9 leads reais não foram
// capturados). Ping a cada 5min, bem abaixo do limiar de 15min de hibernação.
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
