import { NextResponse } from 'next/server'
import { listarNumeros, obterStatusBot, listarFluxos } from '@/lib/integrações/sendpulse'
import { getOrFetch } from '@/lib/cache'
import type { DadosMonitoramento, NumeroMonitorado } from '@/types'

export const maxDuration = 60

const TIMEOUT_BOT_MS = 60_000
const BATCH_SIZE = 5
const TTL_MS = 15_000

const enviadasSnapshot = new Map<string, number>()
const ultimoAumentoMs = new Map<string, number>()

async function fetchComTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs = TIMEOUT_BOT_MS
): Promise<{ ok: true; valor: T } | { ok: false }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const valor = await fn(controller.signal)
    return { ok: true, valor }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}

async function processarBot(numero: Awaited<ReturnType<typeof listarNumeros>>[number]): Promise<NumeroMonitorado> {
  const [statsR, fluxosR] = await Promise.allSettled([
    fetchComTimeout((signal) => obterStatusBot(numero.id, signal)),
    fetchComTimeout((signal) => listarFluxos(numero.id, signal)),
  ])

  const statsOk = statsR.status === 'fulfilled' && statsR.value.ok
  const fluxosOk = fluxosR.status === 'fulfilled' && fluxosR.value.ok
  const statsTotal = statsOk ? (statsR as PromiseFulfilledResult<{ ok: true; valor: Awaited<ReturnType<typeof obterStatusBot>> }>).value.valor.totalMensagensEnviadas : 0

  const snapAnterior = enviadasSnapshot.get(numero.id)
  let aumento = ultimoAumentoMs.get(numero.id) ?? 0
  if (snapAnterior !== undefined && statsTotal > snapAnterior) {
    aumento = Date.now()
  }
  enviadasSnapshot.set(numero.id, statsTotal)
  if (aumento > 0) ultimoAumentoMs.set(numero.id, aumento)

  return {
    numero,
    chats: [],
    totalConversas: 0,
    leadsHoje: 0,
    totalNaoLidas: 0,
    volumeUltimos5Min: 0,
    volumeUltimaHora: 0,
    volumeHoje: 0,
    volumeOutbox5Min: 0,
    chatsScanned: 0,
    chatsTotal: 0,
    totalMensagensEnviadas: statsTotal,
    totalFluxos: fluxosOk ? (fluxosR as PromiseFulfilledResult<{ ok: true; valor: Awaited<ReturnType<typeof listarFluxos>> }>).value.valor.length : 0,
    ultimoAumentoMs: aumento > 0 ? aumento : undefined,
  } as NumeroMonitorado
}

async function fetchAllBots(): Promise<DadosMonitoramento> {
  const numerosResult = await fetchComTimeout((signal) => listarNumeros(signal))
  if (!numerosResult.ok) {
    throw new Error('Timeout ao listar números')
  }
  const numeros = numerosResult.valor

  const dados: NumeroMonitorado[] = []

  for (let i = 0; i < numeros.length; i += BATCH_SIZE) {
    const batch = numeros.slice(i, i + BATCH_SIZE)
    const resultados = await Promise.allSettled(batch.map(processarBot))
    for (const r of resultados) {
      dados.push(
        r.status === 'fulfilled' ? r.value : {
          numero: { id: '', numero: '', nome: 'Erro', status: 'inativo' as const, inboxTotal: 0, inboxNaoLidas: 0 },
          chats: [], totalConversas: 0, leadsHoje: 0, totalNaoLidas: 0, volumeUltimos5Min: 0, volumeUltimaHora: 0, volumeHoje: 0, volumeOutbox5Min: 0, chatsScanned: 0, chatsTotal: 0, totalMensagensEnviadas: 0, totalFluxos: 0,
        }
      )
    }
  }

  return { numeros: dados, ultimaAtualizacao: new Date().toISOString() }
}

export async function GET() {
  try {
    const data = await getOrFetch('live-chat', 'all', TTL_MS, fetchAllBots)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
