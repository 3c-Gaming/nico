import type { DiscordEmbed } from '@/lib/discord/embeds'
import { gtHost, gtAgora } from './client'
import type { GtmetrixMetricas, GtmetrixRodada, GtmetrixConcluido } from './types'

const FOOTER = 'GTmetrix · São Paulo · iPhone · 4G Slow'

function camposMetricas(d: GtmetrixMetricas) {
  return [
    { name: '🏆 Grade', value: `**${d.grade} (${d.gtmetrix}/100)**`, inline: true },
    { name: '⚡ Performance', value: `**${d.score}/100**`, inline: true },
    { name: '🖼 LCP', value: d.lcp, inline: true },
    { name: '📊 TBT', value: d.tbt, inline: true },
    { name: '📐 CLS', value: d.cls, inline: true },
    { name: '🌐 TTFB', value: d.ttfb, inline: true },
    { name: '🎯 FCP', value: d.fcp, inline: true },
    { name: '⚡ Speed Index', value: d.speed_index, inline: true },
    { name: '⏱ Carga Total', value: d.load_time, inline: true },
  ]
}

export function embedGtProblema(url: string, d: GtmetrixMetricas, problemas: string[]): DiscordEmbed {
  return {
    title: `🔴 ${gtHost(url)}`,
    description: `**Problemas detectados:**\n• ${problemas.join('\n• ')}\n\n🔗 ${d.report_url}`,
    color: 0xe74c3c,
    fields: camposMetricas(d),
    footer: { text: `${FOOTER} · ${gtAgora()}` },
    timestamp: new Date().toISOString(),
  }
}

export function embedGtOk(url: string, d: GtmetrixMetricas): DiscordEmbed {
  return {
    title: `🟢 ${gtHost(url)} — passou em todos os limites`,
    description: `🔗 ${d.report_url}`,
    color: 0x2ecc71,
    fields: camposMetricas(d),
    footer: { text: `${FOOTER} · ${gtAgora()}` },
    timestamp: new Date().toISOString(),
  }
}

export function embedGtQuebrada(url: string, motivo: string): DiscordEmbed {
  return {
    title: `💀 ${gtHost(url)} — FORA DO AR`,
    description:
      `**URL:** ${url}\n**Motivo:** ${motivo}\n\n` +
      '_Teste no GTmetrix não foi disparado — crédito preservado._',
    color: 0x992d22,
    footer: { text: `Pré-check HTTP · ${gtAgora()}` },
    timestamp: new Date().toISOString(),
  }
}

// Diferente de embedGtQuebrada: aqui o pré-check HTTP já passou (o site respondeu normalmente),
// só o GTmetrix em si não conseguiu iniciar/concluir o teste (fila cheia, erro da API, timeout
// esperando o relatório). Não é sinal de site fora do ar — misturar os dois gerava alerta falso
// de "FORA DO AR" pra páginas que estavam no ar o tempo todo.
export function embedGtNaoTestado(url: string, motivo: string): DiscordEmbed {
  return {
    title: `⚠️ ${gtHost(url)} — GTmetrix não testou`,
    description:
      `**URL:** ${url}\n**Motivo:** ${motivo}\n\n` +
      '_Pré-check HTTP passou (site respondeu normalmente) — o problema foi só pra rodar o teste no GTmetrix._',
    color: 0xf39c12,
    footer: { text: `GTmetrix · ${gtAgora()}` },
    timestamp: new Date().toISOString(),
  }
}

export function embedGtCreditosInsuficientes(
  necessario: number,
  disponivel: number,
  refill: string,
  cabem: number,
): DiscordEmbed {
  return {
    title: '⚠️ GTmetrix — Créditos insuficientes',
    description:
      `Precisava de **${necessario}** crédito(s), disponível: **${disponivel}**.\n` +
      `Próximo refill: ${refill}\n\nRodando apenas as **${cabem}** primeiras URLs desta vez.`,
    color: 0xf1c40f,
    footer: { text: `Nico Bot · GTmetrix · ${gtAgora()}` },
    timestamp: new Date().toISOString(),
  }
}

export function embedGtChaveRecusada(): DiscordEmbed {
  return {
    title: '🔑 GTmetrix — Chave da API recusada',
    description: 'O GTmetrix devolveu 401/403. Verifique GTMETRIX_API_KEY no ambiente.',
    color: 0xe74c3c,
    footer: { text: `Nico Bot · GTmetrix · ${gtAgora()}` },
    timestamp: new Date().toISOString(),
  }
}

export function embedGtResumo(r: GtmetrixRodada): DiscordEmbed {
  const linhas = r.ok.map((c: GtmetrixConcluido) => {
    const etiqueta = `${c.dados.score}/100`.padEnd(7)
    return `\`${etiqueta}\` **${c.dados.grade}** · LCP ${c.dados.lcp} · ${gtHost(c.url)}`
  })

  let desc = linhas.length
    ? `**✅ Passaram sem problema (${r.ok.length})**\n${linhas.join('\n')}`
    : '**Nenhuma página passou limpa nesta rodada.**'

  desc +=
    `\n\n**📊 Rodada:** ${r.totalTestado} verificada(s) · ${r.ok.length} ok · ` +
    `${r.comProblema.length} com problema · ${r.quebradas.length} fora do ar`
  if (r.falhasApi.length > 0) desc += ` · ${r.falhasApi.length} sem teste (GTmetrix)`

  if (r.creditosAntes !== null) {
    desc += `\n**🎫 Créditos:** ${r.creditosAntes} → ${r.creditosDepois}`
  }

  return {
    title: '📋 GTmetrix — Resumo da rodada',
    description: desc,
    color: r.comProblema.length + r.quebradas.length + r.falhasApi.length === 0 ? 0x2ecc71 : 0xf1c40f,
    footer: { text: `Nico Bot · GTmetrix · ${gtAgora()}` },
    timestamp: new Date().toISOString(),
  }
}
