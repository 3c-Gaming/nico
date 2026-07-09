import { getSupabase } from '@/lib/db/supabase'
import type { BotTestResult, BotTestConfig } from './types'
import { DEFAULT_POLL_INTERVAL_MS } from './types'

function supabase() {
  const s = getSupabase()
  if (!s) throw new Error('Supabase não disponível')
  return s
}

function toRow(r: BotTestResult): Record<string, unknown> {
  return {
    bot_id: r.botId,
    numero: r.numero,
    nome: r.nome,
    ultimo_teste: r.ultimoTeste,
    status: r.status,
    duracao_ms: r.duracaoMs,
    erro: r.erro ?? null,
    ultimo_teste_ok_ms: r.ultimoTesteOkMs ?? null,
    pre_trigger_timestamp: r.preTriggerTimestamp ?? null,
    triggered_at: r.triggeredAt ?? null,
    pendente: r.pendente ?? false,
    ultimo_trigger_ok_ms: r.ultimoTriggerOkMs ?? null,
    updated_at: new Date().toISOString(),
  }
}

function fromRow(row: Record<string, unknown>): BotTestResult {
  return {
    botId: row.bot_id as string,
    numero: (row.numero as string) ?? '',
    nome: (row.nome as string) ?? '',
    ultimoTeste: row.ultimo_teste as string,
    status: row.status as BotTestResult['status'],
    duracaoMs: (row.duracao_ms as number) ?? 0,
    erro: (row.erro as string) ?? undefined,
    ultimoTesteOkMs: (row.ultimo_teste_ok_ms as number) ?? undefined,
    preTriggerTimestamp: (row.pre_trigger_timestamp as string) ?? undefined,
    triggeredAt: (row.triggered_at as string) ?? undefined,
    pendente: (row.pendente as boolean) ?? false,
    ultimoTriggerOkMs: (row.ultimo_trigger_ok_ms as number) ?? undefined,
  }
}

export async function listarResultados(): Promise<BotTestResult[]> {
  try {
    const { data } = await supabase().from('bot_test_results').select('*').order('updated_at', { ascending: false })
    return ((data ?? []) as Record<string, unknown>[]).map(fromRow)
  } catch {
    return []
  }
}

export async function salvarResultado(resultado: BotTestResult) {
  try {
    await supabase().from('bot_test_results').upsert(toRow(resultado) as any)
  } catch (err) {
    console.error('[bot-test.store] salvarResultado error:', err)
  }
}

export async function obterResultado(botId: string): Promise<BotTestResult | null> {
  try {
    const { data } = await supabase().from('bot_test_results').select('*').eq('bot_id', botId).maybeSingle()
    return data ? fromRow(data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function carregarConfig(): Promise<BotTestConfig> {
  try {
    const { data } = await supabase().from('bot_test_config').select('*').eq('id', 1).maybeSingle()
    if (data) {
      return { pollIntervalMs: (data as any).poll_interval_ms ?? DEFAULT_POLL_INTERVAL_MS }
    }
  } catch { /* noop */ }
  return { pollIntervalMs: DEFAULT_POLL_INTERVAL_MS }
}

export async function salvarConfig(config: BotTestConfig) {
  try {
    await supabase().from('bot_test_config').upsert({
      id: 1,
      poll_interval_ms: config.pollIntervalMs,
      updated_at: new Date().toISOString(),
    } as any)
  } catch (err) {
    console.error('[bot-test.store] salvarConfig error:', err)
  }
}
