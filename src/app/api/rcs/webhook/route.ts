import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

// Callback da Solvefy pros eventos de mensagem RCS. Formato do payload:
//   { event: "message.delivered", action: "delivered", channelType: "rcs",
//     recipient: "+5511...", errorReason: null, correlationId, timestamp, ... }
// Pode NÃO vir `id`/`reference` — nesse caso a correlação com `rcs_envios` é pelo telefone
// (`recipient`). Se vier `reference` (= nosso solvefy_message_id), casa por ele primeiro.
// Sem verificação de assinatura (a Solvefy não expôs mecanismo). Este endpoint só é chamado
// como callbackUrl de envios de RCS, então não filtramos por channelType.

// Ordem da jornada — só deixa o status avançar (evita evento fora de ordem regredir).
// 'failed'/'undelivered'/'erro' são terminais e sempre podem sobrescrever.
const ORDEM: Record<string, number> = {
  queued: 0, submitted: 1, sent: 2, delivered: 3, read: 4, clicked: 5,
  failed: 9, undelivered: 9, erro: 9,
}
const CLIQUE = new Set(['clicked', 'click', 'clickthrough', 'clique'])

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrair(body: any): { status: string | null; erro: string | null; ref: string | null; telefone: string } {
  const alvo = body?.data ?? body
  const bruto = body?.action ?? alvo?.action ?? alvo?.status ?? body?.event ?? body?.type ?? null
  const status = bruto ? String(bruto).replace(/^message\./, '').toLowerCase() : null
  const erro = body?.errorReason ?? alvo?.errorReason ?? body?.error ?? null
  const ref = alvo?.reference ?? body?.reference ?? alvo?.messageReference ?? alvo?.id ?? body?.id ?? null
  const telefone = digits(body?.recipient ?? alvo?.recipient ?? body?.to ?? alvo?.to)
  return { status, erro: erro ? String(erro) : null, ref: ref ? String(ref) : null, telefone }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function acharEnvio(supabase: any, ref: string | null, telefone: string) {
  if (ref) {
    const { data } = await supabase.from('rcs_envios').select('id, status').eq('solvefy_message_id', ref).limit(1)
    if (data?.[0]) return data[0] as { id: string; status: string }
  }
  if (telefone) {
    const { data } = await supabase
      .from('rcs_envios')
      .select('id, status, enviado_em')
      .eq('telefone', telefone)
      .order('enviado_em', { ascending: false })
      .limit(10)
    const rows = (data ?? []) as { id: string; status: string }[]
    // pega a linha mais recente que ainda não é terminal; se todas forem terminais, a mais recente
    return rows.find((r) => (ORDEM[r.status] ?? 0) < 9) ?? rows[0] ?? null
  }
  return null
}

export async function POST(request: NextRequest) {
  // Sempre 200 — a Solvefy não deve reenviar por erro nosso (DB fora, payload estranho etc.);
  // um 5xx só polui o painel de webhooks deles. O que der errado vai pro log.
  try {
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: true, ignored: 'body-vazio' })

    const { status, erro, ref, telefone } = extrair(body)
    if (!status) return NextResponse.json({ ok: true, ignored: 'no-status' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getSupabase() as any
    if (!supabase) return NextResponse.json({ ok: true, ignored: 'sem-db' })

    const envio = await acharEnvio(supabase, ref, telefone)
    if (!envio) {
      console.warn(`[rcs-webhook] sem match — status=${status} ref=${ref} tel=${telefone}`)
      return NextResponse.json({ ok: true, matched: 'none' })
    }

    const agora = new Date().toISOString()

    // Clique é sinal separado — marca a flag e NÃO mexe no status da jornada (um 'read' pode
    // receber clique depois).
    if (CLIQUE.has(status)) {
      await supabase.from('rcs_envios').update({ clicado: true, atualizado_em: agora }).eq('id', envio.id)
      return NextResponse.json({ ok: true, matched: 'ok', tipo: 'clique' })
    }

    // Jornada: só avança (ou vira terminal).
    const nova = ORDEM[status] ?? 0
    const atual = ORDEM[envio.status] ?? 0
    if (nova < atual && nova < 9) {
      return NextResponse.json({ ok: true, matched: 'ignorado', motivo: `evento ${status} atrás de ${envio.status}` })
    }

    await supabase.from('rcs_envios').update({ status, erro, atualizado_em: agora }).eq('id', envio.id)
    return NextResponse.json({ ok: true, matched: ref ? 'reference' : 'recipient', status })
  } catch (e) {
    console.error('[rcs-webhook] erro:', (e as Error).message)
    return NextResponse.json({ ok: true, error: 'interno' })
  }
}
