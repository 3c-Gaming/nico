import { NextResponse } from 'next/server'
import { listarNumeros, listarChatsAtivos } from '@/lib/integrações/sendpulse'
import { getOrFetch } from '@/lib/cache'
import type { DadosMonitoramento, NumeroMonitorado } from '@/types'

const TIMEOUT_BOT_MS = 30_000
const BATCH_SIZE = 3
const TTL_MS = 15_000

function contarLeadsHoje(chats: { ultimaAtividade: string }[]): number {
  const agora = new Date()
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const fim = inicio + 86_400_000
  return chats.filter((c) => {
    const data = new Date(c.ultimaAtividade).getTime()
    return !isNaN(data) && data >= inicio && data < fim
  }).length
}

function somarNaoLidas(chats: { naoLidas: number }[]): number {
  return chats.reduce((acc, c) => acc + c.naoLidas, 0)
}

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

async function fetchFullMonitoramento(): Promise<DadosMonitoramento> {
  const numerosResult = await fetchComTimeout((signal) => listarNumeros(signal))
  if (!numerosResult.ok) {
    throw new Error('Timeout ao listar números')
  }
  const numeros = numerosResult.valor

  const dados: NumeroMonitorado[] = []
  for (let i = 0; i < numeros.length; i += BATCH_SIZE) {
    const batch = numeros.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (numero) => {
        const r = await fetchComTimeout((signal) => listarChatsAtivos(numero.id, signal))
        if (!r.ok) {
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
            totalMensagensEnviadas: 0,
            totalFluxos: 0,
          } as NumeroMonitorado
        }
        const { chats, total } = r.valor
        return {
          numero,
          chats,
          totalConversas: total,
          leadsHoje: contarLeadsHoje(chats),
          totalNaoLidas: somarNaoLidas(chats),
          volumeUltimos5Min: 0,
          volumeUltimaHora: 0,
          volumeHoje: contarLeadsHoje(chats),
          volumeOutbox5Min: 0,
          chatsScanned: chats.length,
          chatsTotal: total,
          totalMensagensEnviadas: 0,
          totalFluxos: 0,
          } as NumeroMonitorado
      })
    )
    for (const r of batchResults) {
      dados.push(r.status === 'fulfilled' ? (r.value as NumeroMonitorado) : {
        numero: { id: '', numero: '', nome: 'Erro', status: 'inativo' as const, inboxTotal: 0, inboxNaoLidas: 0 },
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
        totalMensagensEnviadas: 0,
        totalFluxos: 0,
      } as NumeroMonitorado)
    }
  }

  return {
    numeros: dados,
    ultimaAtualizacao: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const resposta = await getOrFetch('monitoramento', 'all', TTL_MS, fetchFullMonitoramento)
    return NextResponse.json(resposta)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
