import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

// Callback da Solvefy pros eventos de mensagem RCS. Formato real do payload (confirmado):
//   { event: "message.delivered", action: "delivered", channelType: "rcs"|"sms",
//     recipient: "+5511...", errorReason: null, correlationId, timestamp, ... }
// NÃO vem `id` nem `reference` — a correlação com o nosso `rcs_envios` é feita pelo telefone
// (`recipient`), atualizando a linha mais recente daquele número que ainda não está finalizada.
// Se um dia a Solvefy passar a mandar `reference`/`id`, o caminho por id é tentado antes.
// Sem verificação de assinatura (a Solvefy não expôs mecanismo).

const ESTADOS_FINAIS = new Set(['read', 'failed', 'undelivered'])

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrair(body: any): { status: string | null; erro: string | null; ref: string | null; telefone: string } {
  const alvo = body?.data ?? body
  const bruto = body?.action ?? alvo?.status ?? body?.event ?? body?.type ?? null
  const status = bruto ? String(bruto).replace(/^message\./, '').toLowerCase() : null
  const erro = body?.errorReason ?? alvo?.errorReason ?? body?.error ?? null
  const ref = alvo?.reference ?? body?.reference ?? alvo?.messageReference ?? alvo?.id ?? body?.id ?? null
  const telefone = digits(body?.recipient ?? alvo?.recipient ?? body?.to ?? alvo?.to)
  return { status, erro: erro ? String(erro) : null, ref: ref ? String(ref) : null, telefone }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false }, { status: 400 })

  // Esse endpoint só é usado como callbackUrl dos envios de RCS — se vier evento de outro canal,
  // ignora (defensivo; não deveria acontecer).
  if (body.channelType && String(body.channelType).toLowerCase() !== 'rcs') {
    return NextResponse.json({ ok: true, ignored: 'channel' })
  }

  const { status, erro, ref, telefone } = extrair(body)
  if (!status) return NextResponse.json({ ok: true, ignored: 'no-status' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ ok: true })

  const patch = { status, erro, atualizado_em: new Date().toISOString() }

  if (ref) {
    await supabase.from('rcs_envios').update(patch).eq('solvefy_message_id', ref)
    return NextResponse.json({ ok: true, matched: 'reference' })
  }

  if (telefone) {
    const { data: rows } = await supabase
      .from('rcs_envios')
      .select('id, status')
      .eq('telefone', telefone)
      .order('enviado_em', { ascending: false })
      .limit(10)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alvo = ((rows ?? []) as any[]).find((r) => !ESTADOS_FINAIS.has(r.status))
    if (alvo) {
      await supabase.from('rcs_envios').update(patch).eq('id', alvo.id)
      return NextResponse.json({ ok: true, matched: 'recipient' })
    }
  }

  // 200 sempre — não faz a Solvefy reenviar por evento que não casou com nenhuma linha.
  return NextResponse.json({ ok: true, matched: 'none' })
}
