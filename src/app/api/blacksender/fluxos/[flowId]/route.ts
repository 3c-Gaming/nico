import { NextResponse } from 'next/server'
import { listarBlacksenderFlowRuns } from '@/lib/db/supabase'

export async function GET(_req: Request, { params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params
  const execucoes = await listarBlacksenderFlowRuns(flowId)

  const porStatus: Record<string, number> = {}
  for (const e of execucoes) {
    const status = e.status ?? 'desconhecido'
    porStatus[status] = (porStatus[status] ?? 0) + 1
  }

  return NextResponse.json({ flowId, total: execucoes.length, porStatus, execucoes })
}
