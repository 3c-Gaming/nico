import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, registrarWebhookEvento } from '@/lib/db/supabase'

// Webhook público que a Solvefy chama quando um evento de mensagem acontece (message.sent,
// message.delivered, message.clicked etc. — ver callbackUrl no envio, em enviarSms). Não temos a
// especificação exata do payload deles (não documentada no que recebemos até agora), então o
// parsing é defensivo: tenta achar id/status em alguns formatos plausíveis (plano, ou aninhado em
// "data", com "event"/"type" no lugar de "status") em vez de assumir um formato único.
//
// Sem verificação de assinatura/segredo — a Solvefy não documentou nenhum mecanismo de auth pro
// callback até onde sabemos. Se um dia expuserem um header de assinatura, validar aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrairIdEStatus(body: any): { id: string | null; status: string | null } {
  const alvo = body?.data ?? body
  const id: string | null = alvo?.id ?? alvo?.reference ?? body?.reference ?? null
  const eventoOuStatus: string | null = alvo?.status ?? body?.event ?? body?.type ?? null
  // Eventos tipo "message.clicked" viram status "clicked" (mesmo padrão sem prefixo já visto no
  // GET de status).
  const status = eventoOuStatus?.replace(/^message\./, '') ?? null
  return { id, status }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false }, { status: 400 })

  // Grava cru TODO evento recebido (não só os de status que já reconhecemos) — mesmo princípio
  // do webhook da Black Sender: sem isso, nunca vamos saber se/como a Solvefy manda um evento de
  // resposta (SMS MO) até vermos o payload real na tabela webhook_eventos_recebidos (ver
  // /api/webhooks/eventos?origem=sms pra consultar). Não bloqueia o resto do handler se falhar.
  const headersSms: Record<string, string> = {}
  request.headers.forEach((valor, chave) => { headersSms[chave] = valor })
  await registrarWebhookEvento({
    id: crypto.randomUUID(),
    origem: 'sms',
    evento: body?.event ?? body?.type ?? body?.status ?? 'desconhecido',
    payload: body,
    headers: headersSms,
    metodo: request.method,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    recebidoEm: new Date().toISOString(),
  }).catch(() => {})

  const { id, status } = extrairIdEStatus(body)

  if (id && status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getSupabase() as any
    if (supabase) {
      await supabase
        .from('sms_envios')
        .update({ status, atualizado_em: new Date().toISOString() })
        .eq('solvefy_message_id', id)
    }
  }

  // Sempre 200 — webhook não deve ficar tentando de novo por payload que não reconhecemos.
  return NextResponse.json({ ok: true })
}
