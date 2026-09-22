import { NextRequest, NextResponse } from 'next/server'
import { listarWebhookEventosRecebidos } from '@/lib/db/supabase'

// Consulta o log cru de webhooks recebidos (ver registrarWebhookEvento) — usado pra inspecionar
// o payload real de um evento ainda não mapeado (ex: reply/postback do RCS, resposta MO do SMS)
// sem precisar de acesso direto ao banco. GET /api/webhooks/eventos?origem=rcs&limite=10
export async function GET(request: NextRequest) {
  const origem = request.nextUrl.searchParams.get('origem') ?? undefined
  const limiteParam = request.nextUrl.searchParams.get('limite')
  const limite = limiteParam ? Math.min(Number(limiteParam) || 50, 200) : 50
  const eventos = await listarWebhookEventosRecebidos(origem, limite)
  return NextResponse.json({ total: eventos.length, eventos })
}
