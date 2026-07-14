import { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { listaPaginas, detalhesPagina, menuPrincipal } from '../keyboards'
import { paginasCache } from '../types'
import {
  getGhToken, fetchFileFromGitHub,
  extractDestinations, extractText,
  extractRedirectUrl, extractLeadFlowConfig, extractRedirectConfig,
} from '@/lib/paginas/github-sync'

export async function handleListarPaginas(ctx: Context) {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) {
      await ctx.answerCallbackQuery('Erro: Supabase indisponível')
      return
    }

    const { data } = await sb.from('paginas').select('*').order('nome')
    const paginas = (data ?? []) as any[]

    const chatId = ctx.chat!.id
    paginasCache.set(chatId, paginas)

    const indices = new Map<string, number>()
    paginas.forEach((p, i) => indices.set(p.id, i))

    if (paginas.length === 0) {
      await ctx.editMessageText('📄 Nenhuma página cadastrada ainda.')
      await ctx.answerCallbackQuery()
      return
    }

    await ctx.editMessageText(
      `📄 *Páginas* (${paginas.length})\nSelecione uma página:`,
      { reply_markup: listaPaginas(paginas, indices), parse_mode: 'Markdown' }
    )
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleListarPaginas:', err)
    await ctx.answerCallbackQuery('Erro ao listar páginas')
  }
}

export async function handleVerPagina(ctx: Context, paginaIdx: number) {
  try {
    const chatId = ctx.chat!.id
    const paginas = paginasCache.get(chatId)
    if (!paginas || !paginas[paginaIdx]) {
      await ctx.answerCallbackQuery('Página não encontrada. Tente listar novamente.')
      return
    }

    const pagina = paginas[paginaIdx]
    const tipo = pagina.tipo || 'whatsapp'

    // Para whatsapp e html_whatsapp, mostrar destinations
    if (tipo === 'whatsapp' || tipo === 'html_whatsapp') {
      return showWhatsappView(ctx, pagina, paginaIdx)
    }

    // Para outros tipos, buscar do GitHub
    if (!pagina.tracking_file) {
      await ctx.editMessageText(
        `📄 *${pagina.nome}*\n📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n\n_Sem arquivo de tracking configurado_`,
        { parse_mode: 'Markdown' }
      )
      await ctx.answerCallbackQuery()
      return
    }

    try {
      const token = await getGhToken()
      const content = await fetchFileFromGitHub(token, pagina.github_owner, pagina.github_repo, pagina.tracking_file)
      if (!content) {
        await ctx.editMessageText(
          `📄 *${pagina.nome}*\n\n❌ Arquivo \`${pagina.tracking_file}\` não encontrado no repo`,
          { parse_mode: 'Markdown' }
        )
        await ctx.answerCallbackQuery()
        return
      }

      if (tipo === 'direto' || pagina.tracking_file.includes('RedirectUrl') || pagina.tracking_file.includes('TrackingRedirect')) {
        return showRedirectUrlView(ctx, pagina, paginaIdx, content)
      }

      if (pagina.tracking_file.includes('leadFlow')) {
        return showLeadFlowView(ctx, pagina, paginaIdx, content)
      }

      if (pagina.tracking_file.includes('redirect.ts')) {
        return showRedirectConfigView(ctx, pagina, paginaIdx, content)
      }

      // Fallback
      await ctx.editMessageText(
        `📄 *${pagina.nome}*\n📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n📝 \`${pagina.tracking_file}\`\n\n_Tipo não suportado para edição_`,
        { parse_mode: 'Markdown' }
      )
      await ctx.answerCallbackQuery()
    } catch (err) {
      console.error('[telegram] handleVerPagina fetch:', err)
      await ctx.editMessageText(
        `📄 *${pagina.nome}*\n\n❌ Erro ao buscar arquivo: ${(err as Error).message}`,
        { parse_mode: 'Markdown' }
      )
      await ctx.answerCallbackQuery()
    }
  } catch (err) {
    console.error('[telegram] handleVerPagina:', err)
    await ctx.answerCallbackQuery('Erro ao ver página')
  }
}

// --- Helpers ---

/** Parsear query params de uma URL (inclui hash params tipo #/home?...) */
function parseUrlParams(urlStr: string): Array<{ key: string; value: string }> {
  try {
    // Tratar URLs com params no hash (ex: betmgm.bet.br/...#/home?eventIds=...)
    let search = ''
    if (urlStr.includes('?')) {
      search = urlStr.split('?').slice(1).join('?')
    }
    if (!search) return []
    const params = new URLSearchParams(search)
    const result: Array<{ key: string; value: string }> = []
    for (const [k, v] of params) {
      result.push({ key: k, value: v })
    }
    return result
  } catch {
    return []
  }
}

/** Gerar keyboard com botões pra editar cada param da URL + URL base */
function urlParamsKeyboard(paginaIdx: number, params: Array<{ key: string }>, extraCampos: string[] = []): InlineKeyboard {
  const kb = new InlineKeyboard()
  // Botão pra editar URL inteira
  kb.text('✏️ redirectUrl (inteira)', `pg:ec:${paginaIdx}:redirectUrl`).row()
  // Botões por parâmetro
  for (const p of params) {
    kb.text(`✏️ ${p.key}`, `pg:ec:${paginaIdx}:url:${p.key}`).row()
  }
  // Campos extras (spreadsheetId, sheetTab, etc)
  for (const c of extraCampos) {
    kb.text(`✏️ ${c}`, `pg:ec:${paginaIdx}:${c}`).row()
  }
  kb.text('⬅️ Voltar', 'pg:list')
  return kb
}

// --- Views por tipo ---

function showWhatsappView(ctx: Context, pagina: any, paginaIdx: number) {
  const dests = pagina.destinations ?? []
  let texto = `📄 *${pagina.nome}*\n`
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n\n`

  if (dests.length === 0) {
    texto += '_Nenhum destination configurado_'
  } else {
    texto += '*Destinos:*\n'
    dests.forEach((d: any, i: number) => {
      const flowShort = d.flowId ? '...' + d.flowId.slice(-8) : 'sem flow'
      texto += `${i + 1}. 📞 \`${d.phone}\` · # \`${flowShort}\` · ${d.weight}%\n`
    })
    texto += '\n_Clique num destino para editar:_'
  }

  return Promise.all([
    ctx.editMessageText(texto, {
      reply_markup: detalhesPagina(paginaIdx, dests),
      parse_mode: 'Markdown',
    }),
    ctx.answerCallbackQuery(),
  ])
}

function showRedirectUrlView(ctx: Context, pagina: any, paginaIdx: number, content: string) {
  const url = extractRedirectUrl(content)
  const params = parseUrlParams(url)

  let texto = `📄 *${pagina.nome}* (direto)\n`
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n\n`
  texto += `🔗 *Redirect URL:*\n\`${url || 'não encontrada'}\`\n\n`

  if (params.length > 0) {
    texto += '*Parâmetros:*\n'
    for (const p of params) {
      texto += `• *${p.key}:* \`${p.value}\`\n`
    }
    texto += '\n'
  }
  texto += '_Clique para editar:_'

  return Promise.all([
    ctx.editMessageText(texto, {
      reply_markup: urlParamsKeyboard(paginaIdx, params),
      parse_mode: 'Markdown',
    }),
    ctx.answerCallbackQuery(),
  ])
}

function showLeadFlowView(ctx: Context, pagina: any, paginaIdx: number, content: string) {
  const config = extractLeadFlowConfig(content)
  let texto = `📄 *${pagina.nome}* (formulário)\n`
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n\n`

  if (!config) {
    texto += '_LEAD\\_FLOW\\_CONFIG não encontrado_'
    return Promise.all([
      ctx.editMessageText(texto, { parse_mode: 'Markdown' }),
      ctx.answerCallbackQuery(),
    ])
  }

  // Mostrar redirectUrl e seus parâmetros
  texto += `🔗 *redirectUrl:*\n\`${config.redirectUrl}\`\n\n`
  const params = parseUrlParams(config.redirectUrl)
  if (params.length > 0) {
    texto += '*Parâmetros da URL:*\n'
    for (const p of params) {
      texto += `• *${p.key}:* \`${p.value}\`\n`
    }
    texto += '\n'
  }
  texto += `📊 *spreadsheetId:* \`${config.spreadsheetId}\`\n`
  texto += `📋 *sheetTab:* \`${config.sheetTab}\`\n`
  texto += `🔘 *ctaLabel:* \`${config.ctaLabel}\`\n`
  texto += `⏳ *ctaLoadingLabel:* \`${config.ctaLoadingLabel}\`\n\n`
  texto += '_Clique para editar:_'

  const extraCampos = ['spreadsheetId', 'sheetTab', 'ctaLabel', 'ctaLoadingLabel']

  return Promise.all([
    ctx.editMessageText(texto, {
      reply_markup: urlParamsKeyboard(paginaIdx, params, extraCampos),
      parse_mode: 'Markdown',
    }),
    ctx.answerCallbackQuery(),
  ])
}

function showRedirectConfigView(ctx: Context, pagina: any, paginaIdx: number, content: string) {
  const config = extractRedirectConfig(content)
  let texto = `📄 *${pagina.nome}* (formulário/redirect)\n`
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n\n`

  if (!config) {
    texto += '_REDIRECT\\_CONFIG não encontrado_'
    return Promise.all([
      ctx.editMessageText(texto, { parse_mode: 'Markdown' }),
      ctx.answerCallbackQuery(),
    ])
  }

  texto += `🔗 *baseUrl:* \`${config.baseUrl}\`\n`
  texto += `📄 *lpage:* \`${config.lpage}\`\n`
  texto += `🆔 *siteId:* \`${config.siteId}\`\n`
  texto += `🏷️ *s1:* \`${config.s1}\`\n\n`
  texto += '_Clique para editar:_'

  const kb = new InlineKeyboard()
  for (const campo of ['baseUrl', 'lpage', 'siteId', 's1']) {
    kb.text(`✏️ ${campo}`, `pg:ec:${paginaIdx}:${campo}`).row()
  }
  kb.text('⬅️ Voltar', 'pg:list')

  return Promise.all([
    ctx.editMessageText(texto, {
      reply_markup: kb,
      parse_mode: 'Markdown',
    }),
    ctx.answerCallbackQuery(),
  ])
}
