import { NextResponse } from 'next/server'
import { contarBlacksenderLeadsPorFlowNoDia } from '@/lib/db/supabase'

// Espelha /api/sendpulse/contagem-intervalo pro motor de Funis (ver buscarResultadosDoDia em
// src/lib/funis.ts) — mas pra fluxos Black Sender, contagem sempre por UM dia (não intervalo) e
// por flowId (não tag+bot). Ver contarBlacksenderLeadsPorFlowNoDia pro critério de "lead".
export async function POST(req: Request) {
  const body = (await req.json()) as { flowIds?: string[]; data?: string }
  const flowIds = body.flowIds ?? []
  const data = body.data

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'Parametro "data" obrigatorio (YYYY-MM-DD)' }, { status: 400 })
  }

  const leads = await contarBlacksenderLeadsPorFlowNoDia(flowIds, data)
  return NextResponse.json({ leads })
}
