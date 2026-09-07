import type { DiscordEmbed } from '@/lib/discord/embeds'
import { CREDITO_POR_TESTE, RESERVA_CREDITOS } from './config'
import {
  consultarCreditos,
  preCheckLote,
  preCheckIndividual,
  iniciarTestesLote,
  aguardarLote,
  avaliar,
} from './client'
import {
  embedGtProblema,
  embedGtOk,
  embedGtQuebrada,
  embedGtCreditosInsuficientes,
} from './embeds'
import type { GtmetrixRodada } from './types'

/**
 * Roda a lista inteira: pré-check grátis → guarda de créditos → dispara e
 * aguarda em lote → classifica. Não fala com o Discord — quem chama monta os
 * embeds a partir do retorno (cron e /gtmetrix-lista).
 */
export async function rodarRodadaGTmetrix(urls: string[]): Promise<{
  rodada: GtmetrixRodada
  creditosRecusados: boolean
  avisoCreditos: DiscordEmbed | null
}> {
  const status = await consultarCreditos()
  if (status && status.erro === 'auth') {
    return {
      rodada: {
        totalTestado: urls.length,
        creditosAntes: null,
        creditosDepois: 'N/A',
        ok: [],
        comProblema: [],
        quebradas: [],
        falhasApi: [],
      },
      creditosRecusados: true,
      avisoCreditos: null,
    }
  }

  const creditosAntes = status ? status.creditos : null

  // 1. Pré-check gratuito
  const pre = await preCheckLote(urls)
  let vivas = pre.filter((r) => r.ok).map((r) => r.url)
  const quebradas = pre.filter((r) => !r.ok)

  // 2. Guarda de créditos
  let avisoCreditos: DiscordEmbed | null = null
  const necessario = vivas.length * CREDITO_POR_TESTE
  if (creditosAntes !== null && creditosAntes - necessario < 0) {
    const cabem = Math.max(
      0,
      Math.floor((creditosAntes - RESERVA_CREDITOS) / CREDITO_POR_TESTE),
    )
    avisoCreditos = embedGtCreditosInsuficientes(
      necessario,
      creditosAntes,
      status ? status.refill : 'N/A',
      cabem,
    )
    vivas = vivas.slice(0, cabem)
  }

  // 3. Dispara e aguarda em lote
  const inicio = await iniciarTestesLote(vivas)
  const resultado = await aguardarLote(inicio.pendentes)
  const falhasApi = inicio.falhas.concat(resultado.erros)

  // 4. Classifica
  const ok: GtmetrixRodada['ok'] = []
  const comProblema: GtmetrixRodada['comProblema'] = []
  for (const r of resultado.concluidos) {
    const problemas = avaliar(r.dados)
    if (problemas.length) comProblema.push({ url: r.url, dados: r.dados, problemas })
    else ok.push(r)
  }

  const statusDepois = await consultarCreditos()

  return {
    rodada: {
      totalTestado: urls.length,
      creditosAntes,
      creditosDepois: statusDepois ? statusDepois.creditos : 'N/A',
      ok,
      comProblema,
      quebradas,
      falhasApi,
    },
    creditosRecusados: false,
    avisoCreditos,
  }
}

/**
 * Testa UMA url avulsa e devolve sempre um embed com o relatório completo,
 * passando ou não nos limites. Usado por /gtmetrix.
 */
export async function testarUrlAvulsa(
  url: string,
): Promise<{ embed: DiscordEmbed; ok: boolean }> {
  const status = await consultarCreditos()
  if (status && status.erro === 'auth') {
    return { embed: embedGtQuebrada(url, 'Chave da API do GTmetrix recusada (401/403).'), ok: false }
  }
  if (status && status.creditos < CREDITO_POR_TESTE) {
    return {
      embed: embedGtQuebrada(
        url,
        `Sem crédito para o teste (disponível: ${status.creditos}, refill: ${status.refill}).`,
      ),
      ok: false,
    }
  }

  const pre = await preCheckIndividual(url)
  if (!pre.ok) {
    return { embed: embedGtQuebrada(url, pre.motivo || `HTTP ${pre.status}`), ok: false }
  }

  const inicio = await iniciarTestesLote([url])
  if (inicio.falhas.length) {
    return { embed: embedGtQuebrada(url, inicio.falhas[0].motivo), ok: false }
  }

  const resultado = await aguardarLote(inicio.pendentes)
  if (resultado.erros.length || resultado.concluidos.length === 0) {
    const motivo = resultado.erros[0]?.motivo || 'Timeout aguardando o relatório'
    return { embed: embedGtQuebrada(url, motivo), ok: false }
  }

  const r = resultado.concluidos[0]
  const problemas = avaliar(r.dados)
  return problemas.length
    ? { embed: embedGtProblema(r.url, r.dados, problemas), ok: false }
    : { embed: embedGtOk(r.url, r.dados), ok: true }
}
