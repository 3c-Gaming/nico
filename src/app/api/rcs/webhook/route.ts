import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

// Callback da Solvefy pros eventos de mensagem RCS (e do fallback SMS nativo).
// Correlação, em ordem de confiança:
//   1. metadata.campanha + metadata.telefone (passamos no envio, volta em TODO webhook)
//   2. reference (= nosso solvefy_message_id)
//   3. recipient (telefone) — linha mais recente daquela número
// channelType 'sms' = evento do fallback → grava em fallback_status, não no status da jornada RCS.
// Sempre responde 200. Sem verificação de assinatura (a Solvefy não expôs mecanismo).

const ORDEM: Record<string, number> = {
  queued: 0, submitted: 1, sent: 2, delivered: 3, read: 4, clicked: 5,
  failed: 9, undelivered: 9, erro: 9,
}
const CLIQUE = new Set(['clicked', 'click', 'clickthrough', 'clique'])

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

interface Extraido {
  status: string | null
  erro: string | null
  ref: string | null
  telefone: string
  campanha: string | null
  canal: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrair(body: any): Extraido {
  const alvo = body?.data ?? body
  const meta = body?.metadata ?? alvo?.metadata ?? {}
  const bruto = body?.action ?? alvo?.action ?? alvo?.status ?? body?.event ?? body?.type ?? null
  const status = bruto ? String(bruto).replace(/^message\./, '').toLowerCase() : null
  const erro = body?.errorReason ?? alvo?.errorReason ?? body?.error ?? null
  const ref = alvo?.reference ?? body?.reference ?? alvo?.messageReference ?? alvo?.id ?? body?.id ?? null
  const telMeta = meta?.telefone ? digits(meta.telefone) : ''
  const telefone = telMeta || digits(body?.recipient ?? alvo?.recipient ?? body?.to ?? alvo?.to)
  const canal = String(body?.channelType ?? alvo?.channelType ?? '').toLowerCase() || null
  return {
    status,
    erro: erro ? String(erro) : null,
    ref: ref ? String(ref) : null,
    telefone,
    campanha: meta?.campanha ? String(meta.campanha) : null,
    canal,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function acharEnvio(supabase: any, e: Extraido) {
  if (e.campanha && e.telefone) {
    const { data } = await supabase
      .from('rcs_envios')
      .select('id, status')
      .eq('campanha', e.campanha)
      .eq('telefone', e.telefone)
      .order('enviado_em', { ascending: false })
      .limit(1)
    if (data?.[0]) return data[0] as { id: string; status: string }
  }
  if (e.ref) {
    const { data } = await supabase.from('rcs_envios').select('id, status').eq('solvefy_message_id', e.ref).limit(1)
    if (data?.[0]) return data[0] as { id: string; status: string }
  }
  if (e.telefone) {
    const { data } = await supabase
      .from('rcs_envios')
      .select('id, status, enviado_em')
      .eq('telefone', e.telefone)
      .order('enviado_em', { ascending: false })
      .limit(10)
    const rows = (data ?? []) as { id: string; status: string }[]
    return rows.find((r) => (ORDEM[r.status] ?? 0) < 9) ?? rows[0] ?? null
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: true, ignored: 'body-vazio' })

    const dados = extrair(body)
    if (!dados.status) return NextResponse.json({ ok: true, ignored: 'no-status' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getSupabase() as any
    if (!supabase) return NextResponse.json({ ok: true, ignored: 'sem-db' })

    const envio = await acharEnvio(supabase, dados)
    if (!envio) {
      console.warn(`[rcs-webhook] sem match — status=${dados.status} canal=${dados.canal} camp=${dados.campanha} ref=${dados.ref} tel=${dados.telefone}`)
      return NextResponse.json({ ok: true, matched: 'none' })
    }

    const agora = new Date().toISOString()

    // Evento do fallback SMS — grava separado, não mexe na jornada RCS.
    if (dados.canal === 'sms') {
      await supabase
        .from('rcs_envios')
        .update({ fallback_status: dados.status, atualizado_em: agora })
        .eq('id', envio.id)
      return NextResponse.json({ ok: true, matched: 'ok', tipo: 'fallback-sms', status: dados.status })
    }

    // Clique é sinal separado — marca a flag, não mexe no status.
    if (CLIQUE.has(dados.status)) {
      await supabase.from('rcs_envios').update({ clicado: true, atualizado_em: agora }).eq('id', envio.id)
      return NextResponse.json({ ok: true, matched: 'ok', tipo: 'clique' })
    }

    // Jornada RCS: só avança (ou vira terminal).
    const nova = ORDEM[dados.status] ?? 0
    const atual = ORDEM[envio.status] ?? 0
    if (nova < atual && nova < 9) {
      return NextResponse.json({ ok: true, matched: 'ignorado', motivo: `evento ${dados.status} atrás de ${envio.status}` })
    }

    await supabase.from('rcs_envios').update({ status: dados.status, erro: dados.erro, atualizado_em: agora }).eq('id', envio.id)
    return NextResponse.json({ ok: true, matched: 'ok', status: dados.status })
  } catch (e) {
    console.error('[rcs-webhook] erro:', (e as Error).message)
    return NextResponse.json({ ok: true, error: 'interno' })
  }
}
