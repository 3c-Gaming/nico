/* ============================================================================
 * GTmetrix Monitor — porta do Apps Script (gtmetrix.js) pro nico.
 *
 * Fluxo mantido do original:
 *  1. Pré-check HTTP grátis antes de gastar crédito da API.
 *  2. Guarda de créditos: consulta /status e aborta se não houver saldo.
 *  3. Dispara os testes em lote e faz polling.
 *  4. Discord: embed individual só pra página com PROBLEMA, + 1 embed-resumo.
 * ========================================================================== */

export const GTMETRIX_API_KEY =
  process.env.GTMETRIX_API_KEY || '312ab3ee0ff17aff21e2eb7eb646aaff'

/**
 * Canal de texto do Discord onde o monitor posta (DISCORD_GTMETRIX_CHANNEL_ID).
 * Se não estiver setado, cai no mesmo canal de relatório dos bots.
 */
export function gtmetrixChannelId(): string | undefined {
  return process.env.DISCORD_GTMETRIX_CHANNEL_ID || process.env.DISCORD_REPORT_CHANNEL_ID
}

/* Parâmetros do teste (iguais ao script) */
export const GTMETRIX_LOCATION = '6' // São Paulo
export const GTMETRIX_BROWSER = '3'
export const GTMETRIX_DEVICE = 'iphone_xs_max'
export const GTMETRIX_THROTTLE = '20000/6000/100' // 4G lento

/* Limites que definem "página com problema". É aqui que se calibra o volume de alertas. */
export const LIMITES = {
  performance_min: 50, // score Lighthouse abaixo disso = alerta
  gtmetrix_score_min: 50, // score GTmetrix abaixo disso = alerta
  lcp_max_ms: 4000,
  tbt_max_ms: 600,
  cls_max: 0.25,
  http_ok_max: 399, // status HTTP acima disso = página quebrada
} as const

/* Controle de créditos */
export const CREDITO_POR_TESTE = 1.0 // report 'lighthouse' custa 1 crédito
export const RESERVA_CREDITOS = 5 // deixa isso sobrando pra testes manuais

/* Polling — teto pensado pro limite de execução da função serverless */
export const POLL_INTERVALO_MS = 12_000
export const POLL_MAX_SEGUNDOS = 240

/* Cadência do cron. O Vercel dispara de hora em hora (vercel.json), mas a rota só executa
 * de verdade a cada N horas cheias de Brasília, dentro da janela diurna. Subir esse número
 * = menos rodadas = menos crédito. Hoje: 08h, 12h, 16h, 20h (4x/dia). */
export const GTMETRIX_INTERVALO_HORAS = 4
export const GTMETRIX_JANELA_INICIO = 6   // hora de Brasília
export const GTMETRIX_JANELA_FIM = 23     // hora de Brasília (inclusive)

export const PRECHECK_TIMEOUT_MS = 15_000
