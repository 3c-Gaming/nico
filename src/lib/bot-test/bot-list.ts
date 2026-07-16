import { listarNumeros } from '@/lib/integrações/sendpulse'
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
