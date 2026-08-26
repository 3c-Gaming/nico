import { getSupabase } from '@/lib/db/supabase'
import type { AquecimentoNumero, AquecimentoScript, AquecimentoPar, AquecimentoExecucao, AquecimentoConfig } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any

/** Colunas TIMESTAMP (sem timezone) voltam do Supabase sem 'Z'/offset (ex: "2026-08-26T01:21:05.361")
 * — como o valor gravado sempre foi UTC (todo INSERT/UPDATE aqui usa .toISOString()), sem isso o
 * `new Date(...)` do lado de quem lê interpretaria a string como horário LOCAL do processo, deslocando
 * a data em horas dependendo do fuso da máquina (confirmado ao vivo: em America/Sao_Paulo, deslocava
 * 3h e fazia o cron nunca achar execuções vencidas). Normaliza pra UTC explícito assim que sai do banco. */
function utcISO(raw: string | null): string | null {
  if (!raw) return raw
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`
}

function numeroFromRow(r: Row): AquecimentoNumero {
  return {
    botId: r.bot_id,
    contaId: r.conta_id,
    papel: r.papel,
    status: r.status,
    iniciadoEm: utcISO(r.iniciado_em)!,
    ultimaMensagemEm: utcISO(r.ultima_mensagem_em),
    mensagensHoje: r.mensagens_hoje,
    mensagensHojeData: r.mensagens_hoje_data,
    notas: r.notas,
  }
}

function scriptFromRow(r: Row): AquecimentoScript {
  return {
    id: r.id,
    nome: r.nome,
    tema: r.tema,
    mensagens: r.mensagens ?? [],
    ativo: r.ativo,
    criadoEm: utcISO(r.criado_em)!,
  }
}

function parFromRow(r: Row): AquecimentoPar {
  return {
    id: r.id,
    botIdA: r.bot_id_a,
    botIdB: r.bot_id_b,
    contactIdA: r.contact_id_a,
    contactIdB: r.contact_id_b,
    ativo: r.ativo,
    criadoEm: utcISO(r.criado_em)!,
  }
}

function execucaoFromRow(r: Row): AquecimentoExecucao {
  return {
    id: r.id,
    parId: r.par_id,
    scriptId: r.script_id,
    proximoIndice: r.proximo_indice,
    status: r.status,
    proximaMensagemEm: utcISO(r.proxima_mensagem_em),
    iniciadaEm: utcISO(r.iniciada_em)!,
    atualizadaEm: utcISO(r.atualizada_em)!,
  }
}

function configFromRow(r: Row): AquecimentoConfig {
  return {
    id: r.id,
    janelaInicioHora: r.janela_inicio_hora,
    janelaFimHora: r.janela_fim_hora,
    cronPaused: r.cron_paused,
    rampa: r.rampa ?? {},
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireSupabase(): any {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase não disponível')
  return supabase
}

export async function listarAquecimentoNumeros(): Promise<AquecimentoNumero[]> {
  const { data, error } = await requireSupabase().from('aquecimento_numeros').select('*').order('iniciado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(numeroFromRow)
}

export async function obterAquecimentoNumero(botId: string): Promise<AquecimentoNumero | null> {
  const { data, error } = await requireSupabase().from('aquecimento_numeros').select('*').eq('bot_id', botId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? numeroFromRow(data) : null
}

export async function listarAquecimentoScripts(): Promise<AquecimentoScript[]> {
  const { data, error } = await requireSupabase().from('aquecimento_scripts').select('*').order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(scriptFromRow)
}

export async function obterAquecimentoScript(id: string): Promise<AquecimentoScript | null> {
  const { data, error } = await requireSupabase().from('aquecimento_scripts').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? scriptFromRow(data) : null
}

export async function listarAquecimentoPares(): Promise<AquecimentoPar[]> {
  const { data, error } = await requireSupabase().from('aquecimento_pares').select('*').order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(parFromRow)
}

export async function obterAquecimentoPar(id: string): Promise<AquecimentoPar | null> {
  const { data, error } = await requireSupabase().from('aquecimento_pares').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? parFromRow(data) : null
}

export async function listarAquecimentoExecucoes(): Promise<AquecimentoExecucao[]> {
  const { data, error } = await requireSupabase().from('aquecimento_execucoes').select('*').order('iniciada_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(execucaoFromRow)
}

export async function obterAquecimentoConfig(): Promise<AquecimentoConfig> {
  const { data, error } = await requireSupabase().from('aquecimento_config').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { id: 1, janelaInicioHora: 8, janelaFimHora: 21, cronPaused: false, rampa: { '1': 2, '2': 3, '3': 4, '5': 6, '7': 8, '10': 12, '14': 15 } }
  return configFromRow(data)
}

export { numeroFromRow, scriptFromRow, parFromRow, execucaoFromRow, configFromRow }
