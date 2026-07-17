import { listarNumeros } from '@/lib/integrações/sendpulse'
import { getPreferencias } from '@/lib/db/supabase'
import type { BotConfig } from './types'

export async function obterBots(): Promise<BotConfig[]> {
  const numeros = await listarNumeros()
  return numeros.map((n) => ({
    botId: n.id,
    numero: n.numero,
    botNumero: n.numero,
    nome: n.nome,
  }))
}

export async function obterBotsPinados(): Promise<BotConfig[]> {
  const [todos, { pinnedNumeros }] = await Promise.all([
    obterBots(),
    getPreferencias(),
  ])
  return todos.filter((b) => pinnedNumeros.includes(b.botId))
}
