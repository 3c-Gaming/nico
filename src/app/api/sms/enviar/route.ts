import { NextRequest, NextResponse } from 'next/server'
import { enviarSms, normalizarTelefone } from '@/lib/integrações/solvefy'
import { getSupabase } from '@/lib/db/supabase'

interface Destinatario {
  telefone: string
  variables?: Record<string, string>
}

interface EnviarBody {
  campanha: string
  from: string
  corpo: string
  useShortener?: boolean
  destinatarios: Destinatario[]
}

interface ResultadoEnvio {
  telefone: string
  ok: boolean
  status?: string
  erro?: string
}

// Concorrência controlada — a Solvefy aceita até 100 req/s, mas manda em lotes pequenos evita
// estourar timeout da function e deixa a barra de progresso do front fazer sentido.
const TAMANHO_LOTE = 10

// A Solvefy só aceita letras, dígitos, ".", "_", "~" ou "-" em `reference` (max 64 chars) — o
// nome da campanha pode ter espaço/acento/":" (é texto livre digitado no front), então sanitiza
// antes de concatenar com o telefone.
function sanitizarReference(valor: string): string {
  return valor
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._~-]/g, '-')
    .slice(0, 64)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EnviarBody
    if (!body.campanha || !body.from || !body.corpo || !Array.isArray(body.destinatarios) || body.destinatarios.length === 0) {
      return NextResponse.json({ error: 'campanha, from, corpo e destinatarios são obrigatórios' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getSupabase() as any
    const resultados: ResultadoEnvio[] = []
    // Deriva do próprio request (não hardcoded) — funciona em produção e em preview deployments;
    // em localhost a Solvefy simplesmente não vai conseguir alcançar essa URL, então nenhum
    // callback chega (comportamento aceitável em dev — só produção recebe clique/status via
    // webhook de verdade).
    const callbackUrl = `${request.nextUrl.origin}/api/sms/webhook`

    for (let i = 0; i < body.destinatarios.length; i += TAMANHO_LOTE) {
      const lote = body.destinatarios.slice(i, i + TAMANHO_LOTE)
      const lotesResolvidos = await Promise.all(
        lote.map(async (dest) => {
          const telefone = normalizarTelefone(dest.telefone)
          const resultado = await enviarSms({
            from: body.from,
            to: telefone,
            body: body.corpo,
            variables: dest.variables,
            reference: sanitizarReference(`${body.campanha}-${telefone}`),
            useShortener: body.useShortener,
            shortenerSettings: body.useShortener ? { trackClicks: true, expiryDays: 7 } : undefined,
            callbackUrl,
          })

          if (supabase) {
            await supabase.from('sms_envios').insert({
              campanha: body.campanha,
              telefone,
              solvefy_message_id: resultado.id ?? null,
              status: resultado.ok ? (resultado.status ?? 'queued') : 'erro',
              erro: resultado.ok ? null : resultado.error,
            })
          }

          return { telefone, ok: resultado.ok, status: resultado.status, erro: resultado.error } as ResultadoEnvio
        }),
      )
      resultados.push(...lotesResolvidos)
    }

    const enviados = resultados.filter((r) => r.ok).length
    return NextResponse.json({ total: resultados.length, enviados, falhas: resultados.length - enviados, resultados })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
