import { getSupabase } from '@/lib/db/supabase'
import type { TestResult } from './types'

function supabase() {
  const s = getSupabase()
  if (!s) throw new Error('Supabase não disponível')
  return s as any
}

function toRow(r: TestResult): Record<string, unknown> {
  return {
    id: r.id,
    bot_id: r.botId,
    status: r.status,
    mensagem_enviada: r.mensagemEnviada,
    resposta_recebida: r.respostaRecebida ?? null,
    links_encontrados: r.linksEncontrados ?? null,
    links_verificados: r.linksVerificados ?? null,
    duracao_ms: r.duracaoMs,
    criado_em: r.criadoEm,
    erro: r.erro ?? null,
  }
}

function fromRow(row: Record<string, unknown>): TestResult {
  return {
    id: row.id as string,
    botId: row.bot_id as string,
    status: row.status as TestResult['status'],
    mensagemEnviada: (row.mensagem_enviada as string) ?? 'Olá',
    respostaRecebida: (row.resposta_recebida as string) ?? undefined,
    linksEncontrados: (row.links_encontrados as string[]) ?? undefined,
    linksVerificados: (row.links_verificados as { url: string; statusCode?: number; utms: Record<string, string> }[]) ?? undefined,
    duracaoMs: (row.duracao_ms as number) ?? 0,
    criadoEm: row.criado_em as string,
    erro: (row.erro as string) ?? undefined,
  }
}

export async function listarTestes(): Promise<TestResult[]> {
  try {
    const { data } = await supabase().from('testes').select('*').order('criado_em', { ascending: false }).limit(200)
    return ((data ?? []) as Record<string, unknown>[]).map(fromRow)
  } catch {
    return []
  }
}

export async function salvarResultado(resultado: TestResult) {
  try {
    await supabase().from('testes').upsert(toRow(resultado) as any)
  } catch (err) {
    console.error('[testes.store] salvarResultado error:', err)
  }
}

export async function buscarTestePendente(from: string): Promise<TestResult | null> {
  try {
    const { data: testes } = await supabase()
      .from('testes')
      .select('*')
      .in('status', ['pending', 'aguardando_resposta'])
      .order('criado_em', { ascending: false })
      .limit(50)

    if (!testes?.length) return null

    const numerosRes = await fetch(
      (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/sendpulse/numeros'
    )
    const numerosData = await numerosRes.json()
    const numeros = numerosData.numeros || []
    const numeroFrom = from.replace(/\D/g, '')

    for (const teste of testes) {
      const bot = numeros.find((n: { id: string }) => n.id === teste.bot_id)
      if (bot) {
        const numeroEncontrado = String(bot.numero).replace(/\D/g, '')
        if (numeroEncontrado === numeroFrom) return fromRow(teste)
      }
    }
  } catch {}
  return null
}

export async function atualizarTeste(id: string, update: Partial<TestResult>) {
  try {
    const row: Record<string, unknown> = {}
    if (update.status !== undefined) row.status = update.status
    if (update.respostaRecebida !== undefined) row.resposta_recebida = update.respostaRecebida
    if (update.linksEncontrados !== undefined) row.links_encontrados = update.linksEncontrados
    if (update.linksVerificados !== undefined) row.links_verificados = update.linksVerificados
    if (update.duracaoMs !== undefined) row.duracao_ms = update.duracaoMs
    if (update.erro !== undefined) row.erro = update.erro

    await supabase().from('testes').update(row).eq('id', id)
  } catch (err) {
    console.error('[testes.store] atualizarTeste error:', err)
  }
}
