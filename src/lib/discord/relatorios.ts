// Monta os embeds dos dois relatórios que rodam tanto sob demanda (/relatorio, /leads) quanto
// automaticamente (cron horário /api/cron/discord-report) — centralizado aqui pra não duplicar a
// lógica de "quais números/funis estão pinados + como calcular a saúde de cada um" nos dois lugares.

import { hojeBrasilISO } from '@/lib/datas'
import { calcularRelatorioFunilBlacksender } from '@/lib/blacksender/relatorio'
import { canalEstaBanido } from './notify-canal-banido'
import { embedRelatorio, embedLeadsBlacksender, type DiscordEmbed } from './embeds'

export async function montarRelatorioNumeros(): Promise<DiscordEmbed> {
  const { listarNumerosTodasContas, listarFluxos } = await import('@/lib/integrações/sendpulse')
  const { apiKeyParaBot } = await import('@/lib/integrações/contasSendpulse')
  const { getPreferencias, listarBlacksenderCanais, verificarRespostaUltimaMensagemCanal } = await import('@/lib/db/supabase')

  const [todosNumeros, { pinnedNumeros, numerosNaoMonitorados }, canaisBS] = await Promise.all([
    listarNumerosTodasContas(AbortSignal.timeout(30_000)),
    getPreferencias(),
    listarBlacksenderCanais(),
  ])

  const numeros = todosNumeros.filter((n) => !numerosNaoMonitorados.includes(n.id) && pinnedNumeros.includes(n.id))
  const fluxosPorBot = new Map<string, Awaited<ReturnType<typeof listarFluxos>>>()
  await Promise.all(numeros.map(async (num) => {
    try {
      fluxosPorBot.set(num.id, await listarFluxos(num.id, apiKeyParaBot(num.id), AbortSignal.timeout(10_000)))
    } catch {
      fluxosPorBot.set(num.id, [])
    }
  }))

  const canaisPinados = canaisBS.filter((c) => pinnedNumeros.includes(c.id))
  const canaisComSaude = await Promise.all(canaisPinados.map(async (c) => {
    const resultado = await verificarRespostaUltimaMensagemCanal(c.id).catch(() => null)
    // metaPhoneStatus pode vir null mesmo com o canal banido (a Meta às vezes some com esse
    // campo em vez de mandar BANNED — ver healthStatus/healthReason nesse caso) — cai pro motivo
    // do healthReason, que a Black Sender sempre preenche quando healthStatus != 'available'.
    const motivo = c.metaPhoneStatus || (c.healthReason ? c.healthReason.slice(0, 100) : null)
    return { nome: c.nome ?? '', telefone: c.telefone ?? '', banido: canalEstaBanido(c), motivo, respondeu: resultado?.respondeu ?? null }
  }))

  return embedRelatorio(numeros, fluxosPorBot, canaisComSaude)
}

/** Um embed por funil Black Sender pinado, no mesmo formato do /leads pra "hoje" — funis
 * SendPulse pinados ficam de fora por enquanto (mesmo escopo decidido pro /leads, ver
 * handleLeads: cálculo de leads por dia pro SendPulse depende de chamadas na API deles por tag,
 * mais lento e fora do que foi pedido até aqui). */
export async function montarRelatoriosFunisPinados(): Promise<DiscordEmbed[]> {
  const { listarFlowTagConfigs, getPreferencias } = await import('@/lib/db/supabase')
  const [todosConfigs, { pinnedFunis }] = await Promise.all([listarFlowTagConfigs(), getPreferencias()])
  const configsBS = todosConfigs.filter((c) => c.origem === 'blacksender')
  const pinados = configsBS.filter((c) => c.funil && pinnedFunis.includes(c.funil))
  const data = hojeBrasilISO()

  return Promise.all(pinados.map(async (cfg) => {
    const relatorio = await calcularRelatorioFunilBlacksender(cfg, data, configsBS)
    return embedLeadsBlacksender({ nome: cfg.funil || cfg.flowId, tipo: 'funil', data, ...relatorio })
  }))
}
