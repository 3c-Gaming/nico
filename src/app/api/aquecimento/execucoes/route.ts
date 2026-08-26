import { NextRequest, NextResponse } from 'next/server'
import { requireSupabase, listarAquecimentoExecucoes, execucaoFromRow } from '@/lib/aquecimento/db'

export async function GET() {
  try {
    const execucoes = await listarAquecimentoExecucoes()
    return NextResponse.json({ execucoes })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

/** Inicia um script rodando num par — a primeira mensagem fica agendada pra agora, o cron
 * pega na próxima passada (dentro da janela de horário configurada). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (!body.parId || !body.scriptId) {
    return NextResponse.json({ error: 'parId e scriptId são obrigatórios' }, { status: 400 })
  }
  try {
    const { data, error } = await requireSupabase()
      .from('aquecimento_execucoes')
      .insert({
        par_id: body.parId,
        script_id: body.scriptId,
        proximo_indice: 0,
        status: 'em_andamento',
        proxima_mensagem_em: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ execucao: execucaoFromRow(data) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
