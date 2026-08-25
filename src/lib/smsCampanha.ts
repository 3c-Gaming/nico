// Lógica de disparo de SMS compartilhada entre o envio imediato (POST /api/sms/enviar) e o cron
// de agendados (GET /api/cron/sms-agendados) — mesmo caminho pros dois, pra não divergir.

import { enviarSms, normalizarTelefone } from '@/lib/integrações/solvefy'
import { getSupabase } from '@/lib/db/supabase'

export interface DestinatarioSms {
  telefone: string
  variables?: Record<string, string>
}

export interface ResultadoEnvioSms {
  telefone: string
  ok: boolean
  status?: string
  erro?: string
}

export interface EnviarCampanhaParams {
  campanha: string
  from: string
  corpo: string
  useShortener?: boolean
  destinatarios: DestinatarioSms[]
  callbackUrl: string
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

export async function enviarCampanhaSms(params: EnviarCampanhaParams): Promise<{
  total: number
  enviados: number
  falhas: number
  resultados: ResultadoEnvioSms[]
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  const resultados: ResultadoEnvioSms[] = []

  for (let i = 0; i < params.destinatarios.length; i += TAMANHO_LOTE) {
    const lote = params.destinatarios.slice(i, i + TAMANHO_LOTE)
    const lotesResolvidos = await Promise.all(
      lote.map(async (dest) => {
        const telefone = normalizarTelefone(dest.telefone)
        const resultado = await enviarSms({
          from: params.from,
          to: telefone,
          body: params.corpo,
          variables: dest.variables,
          reference: sanitizarReference(`${params.campanha}-${telefone}`),
          useShortener: params.useShortener,
          shortenerSettings: params.useShortener ? { trackClicks: true, expiryDays: 7 } : undefined,
          callbackUrl: params.callbackUrl,
        })

        if (supabase) {
          await supabase.from('sms_envios').insert({
            campanha: params.campanha,
            telefone,
            solvefy_message_id: resultado.id ?? null,
            status: resultado.ok ? (resultado.status ?? 'queued') : 'erro',
            erro: resultado.ok ? null : resultado.error,
          })
        }

        return { telefone, ok: resultado.ok, status: resultado.status, erro: resultado.error } as ResultadoEnvioSms
      }),
    )
    resultados.push(...lotesResolvidos)
  }

  const enviados = resultados.filter((r) => r.ok).length
  return { total: resultados.length, enviados, falhas: resultados.length - enviados, resultados }
}
