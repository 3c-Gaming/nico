import { NextResponse } from 'next/server'
import { listarBlacksenderFlows } from '@/lib/db/supabase'

// Lista os fluxos do Black Sender (id + nome legível) — usado no seletor de "vincular fluxo a
// um Funil" (ver FlowTagConfig.origem). Distinto de /api/blacksender/fluxos/[flowId], que traz
// as execuções de UM fluxo.
export async function GET() {
  const fluxos = await listarBlacksenderFlows()
  return NextResponse.json({ fluxos })
}
