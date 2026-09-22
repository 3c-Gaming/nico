// Disparo de RCS — mesmo molde de smsCampanha.ts / telegramCampanha.ts: envio imediato
// (POST /api/rcs/enviar) e cron de agendados (GET /api/cron/rcs-agendados) passam pelo mesmo
// caminho pra não divergir.

import { enviarRcs, SOLVEFY_RCS_AGENT_ID, normalizarTelefone } from '@/lib/integrações/solvefy'
import { getSupabase } from '@/lib/db/supabase'
import { renderizarRcsContent, renderizarFallbackText } from './template'
import type { RcsContent, RcsSmsFallback, RcsReceptivo, DestinatarioRcs, ResultadoEnvioRcs } from './tipos'

export interface EnviarCampanhaRcsParams {
  campanha: string
  /** Agent ID. Default: SOLVEFY_RCS_AGENT_ID do ambiente. */
  from?: string
  /** Template com tokens {{variavel}} — resolvido por destinatário. */
  conteudo: RcsContent
  /** Fallback SMS nativo da Solvefy — a copy é renderizada por destinatário ({{var}} + {{link}}). */
  fallback?: RcsSmsFallback
  /** 2ª mensagem disparada quando o lead clica a suggestion REPLY da 1ª — ver RcsReceptivo. O
   * conteúdo (já com {{variavel}} resolvido) fica gravado em rcs_envios.receptivo_conteudo, pro
   * cron de polling (ver /api/cron/rcs-receptivo) mandar quando detectar o clique. */
  receptivo?: RcsReceptivo
  destinatarios: DestinatarioRcs[]
  callbackUrl: string
}

// Mesma concorrência controlada do SMS — a Solvefy aceita rajada alta, mas lotes pequenos
// evitam estourar o timeout da function e deixam a barra de progresso fazer sentido.
const TAMANHO_LOTE = 10

// A Solvefy só aceita [A-Za-z0-9._~-] em `reference` (max 64) — sanitiza o nome da campanha
// (texto livre com espaço/acento) antes de concatenar com o telefone. Exportada porque o cron de
// receptivo (rcs-receptivo) monta a reference da 2ª mensagem com a mesma regra.
export function sanitizarReference(valor: string): string {
  return valor
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._~-]/g, '-')
    .slice(0, 64)
}

export async function enviarCampanhaRcs(params: EnviarCampanhaRcsParams): Promise<{
  total: number
  enviados: number
  falhas: number
  resultados: ResultadoEnvioRcs[]
}> {
  const from = params.from || SOLVEFY_RCS_AGENT_ID
  if (!from) throw new Error('SOLVEFY_RCS_AGENT_ID não configurado — sem Agent ID não dá pra disparar RCS')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  const resultados: ResultadoEnvioRcs[] = []

  for (let i = 0; i < params.destinatarios.length; i += TAMANHO_LOTE) {
    const lote = params.destinatarios.slice(i, i + TAMANHO_LOTE)
    const resolvidos = await Promise.all(
      lote.map(async (dest) => {
        const telefone = normalizarTelefone(dest.telefone)
        const content = renderizarRcsContent(params.conteudo, dest.variables)

        const fb =
          params.fallback?.enabled && params.fallback.text && params.fallback.from
            ? {
                enabled: true as const,
                channel: 'sms' as const,
                from: params.fallback.from,
                text: renderizarFallbackText(params.fallback, params.conteudo, dest.variables),
              }
            : undefined

        const resultado = await enviarRcs({
          from,
          to: telefone,
          content: content as unknown as Record<string, unknown>,
          reference: sanitizarReference(`${params.campanha}-${telefone}`),
          callbackUrl: params.callbackUrl,
          fallback: fb,
          metadata: { campanha: params.campanha, telefone },
        })

        if (supabase) {
          const receptivoConteudo = params.receptivo?.ativo
            ? renderizarRcsContent(params.receptivo.conteudo, dest.variables)
            : null
          await supabase.from('rcs_envios').insert({
            campanha: params.campanha,
            telefone,
            solvefy_message_id: resultado.id ?? null,
            status: resultado.ok ? (resultado.status ?? 'queued') : 'erro',
            erro: resultado.ok ? null : resultado.error,
            receptivo_conteudo: receptivoConteudo,
          })
        }

        return { telefone, ok: resultado.ok, status: resultado.status, erro: resultado.error } as ResultadoEnvioRcs
      }),
    )
    resultados.push(...resolvidos)
  }

  const enviados = resultados.filter((r) => r.ok).length
  return { total: resultados.length, enviados, falhas: resultados.length - enviados, resultados }
}
