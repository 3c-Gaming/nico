import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'
import { consultarStatusRcs, enviarRcs, SOLVEFY_RCS_AGENT_ID } from '@/lib/integrações/solvefy'
import { sanitizarReference } from '@/lib/rcs/campanha'
import type { RcsContent } from '@/lib/rcs/tipos'

// Formato receptivo (RcsReceptivo, ver src/lib/rcs/tipos.ts): a Solvefy não avisa por webhook
// quando o lead clica a suggestion REPLY, então este cron faz polling em GET /rcs/messages/{id}
// pros envios com receptivo_conteudo pendente e, ao ver status "clicked", dispara a 2ª mensagem.
export const maxDuration = 280
const TAMANHO_LOTE_CICLO = 100
// Não faz sentido ficar consultando um envio muito antigo pra sempre — depois disso, desiste.
const JANELA_HORAS = 48

interface EnvioPendente {
  id: string
  telefone: string
  solvefy_message_id: string | null
  receptivo_conteudo: RcsContent
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ ok: true, verificados: 0, cliques: 0, resultados: [] })

  const corte = new Date(Date.now() - JANELA_HORAS * 60 * 60_000).toISOString()
  const { data, error } = await supabase
    .from('rcs_envios')
    .select('id, telefone, solvefy_message_id, receptivo_conteudo')
    .not('receptivo_conteudo', 'is', null)
    .is('receptivo_enviado_em', null)
    .eq('clicado', false)
    .not('solvefy_message_id', 'is', null)
    .gte('enviado_em', corte)
    .limit(TAMANHO_LOTE_CICLO)
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 })

  const pendentes = (data ?? []) as EnvioPendente[]
  const resultados: { id: string; ok: boolean; clicou?: boolean; erro?: string }[] = []

  for (const envio of pendentes) {
    const statusAtual = await consultarStatusRcs(envio.solvefy_message_id!)
    if (!statusAtual.ok) {
      resultados.push({ id: envio.id, ok: false, erro: statusAtual.error })
      continue
    }
    if (statusAtual.status !== 'clicked') {
      resultados.push({ id: envio.id, ok: true, clicou: false })
      continue
    }

    const agora = new Date().toISOString()
    const from = SOLVEFY_RCS_AGENT_ID
    if (!from) {
      resultados.push({ id: envio.id, ok: false, clicou: true, erro: 'SOLVEFY_RCS_AGENT_ID não configurado' })
      continue
    }

    const envioMsg2 = await enviarRcs({
      from,
      to: envio.telefone,
      content: envio.receptivo_conteudo as unknown as Record<string, unknown>,
      reference: sanitizarReference(`${envio.id}-receptivo`),
      metadata: { receptivoDoEnvio: envio.id, telefone: envio.telefone },
    })

    await supabase
      .from('rcs_envios')
      .update({
        clicado: true,
        atualizado_em: agora,
        receptivo_enviado_em: envioMsg2.ok ? agora : null,
        receptivo_solvefy_message_id: envioMsg2.id ?? null,
        receptivo_erro: envioMsg2.ok ? null : envioMsg2.error ?? 'erro desconhecido',
      })
      .eq('id', envio.id)

    resultados.push({ id: envio.id, ok: envioMsg2.ok, clicou: true, erro: envioMsg2.ok ? undefined : envioMsg2.error })
  }

  return NextResponse.json({
    ok: true,
    verificados: pendentes.length,
    cliques: resultados.filter((r) => r.clicou).length,
    resultados,
  })
}
