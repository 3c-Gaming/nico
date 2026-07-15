import { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { listaPaginas, detalhesPagina, menuPrincipal, listaCasasFiltro } from '../keyboards'
import { paginasCache, casasCache, ensurePaginasCache, ensureCasasCache } from '../types'
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

export async function handleListarCasas(ctx: Context) {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) {
      await ctx.answerCallbackQuery('Erro: Supabase indisponível')
      return
    }

    const [{ data: paginasData }, { data: casasData }] = await Promise.all([
      sb.from('paginas').select('*').order('nome'),
      sb.from('casas_aposta').select('id, nome, cor').order('nome'),
    ])

    const paginas = (paginasData ?? []) as any[]
    const casas = (casasData ?? []) as any[]

    const chatId = ctx.chat!.id
    paginasCache.set(chatId, paginas)
    casasCache.set(chatId, casas)

    // Contar páginas por casa
    const contagens = new Map<string, number>()
    for (const p of paginas) {
      if (p.casa_id) {
        contagens.set(p.casa_id, (contagens.get(p.casa_id) ?? 0) + 1)
      }
    }

    await ctx.editMessageText(
      `🏠 *Casas de Aposta*\nSelecione uma casa para filtrar:`,
      { reply_markup: listaCasasFiltro(casas, contagens), parse_mode: 'Markdown' }
    )
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleListarCasas:', err)
    await ctx.answerCallbackQuery('Erro ao listar casas')
  }
}

export async function handleListarPorCasa(ctx: Context, casaId: string) {
  try {
    const chatId = ctx.chat!.id
    const paginas = await ensurePaginasCache(chatId)
    if (!paginas.length) {
      await ctx.answerCallbackQuery('Nenhuma página encontrada.')
      return
    }

    const casas = await ensureCasasCache(chatId)
    const casa = casas?.find(c => c.id === casaId)
    const casaNome = casa?.nome ?? casaId

    const filtradas = paginas.filter(p => p.casa_id === casaId)
    const indices = new Map<string, number>()
    paginas.forEach((p, i) => indices.set(p.id, i))

    if (filtradas.length === 0) {
      await ctx.editMessageText(
        `🏠 *${casaNome}*\n\n_Nenhuma página encontrada para esta casa._`,
        { parse_mode: 'Markdown' }
      )
      await ctx.answerCallbackQuery()
      return
    }

    await ctx.editMessageText(
      `🏠 *${casaNome}* (${filtradas.length} páginas)\nSelecione uma página:`,
      { reply_markup: listaPaginas(filtradas, indices), parse_mode: 'Markdown' }
    )
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleListarPorCasa:', err)
    await ctx.answerCallbackQuery('Erro ao filtrar por casa')
  }
}

export async function handleVerPagina(ctx: Context, paginaIdx: number) {
  try {
    const chatId = ctx.chat!.id
    const paginas = await ensurePaginasCache(chatId)
    await ensureCasasCache(chatId) // para info de casa nas views
    if (!paginas[paginaIdx]) {
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

/** Obter nome da casa a partir do cache */
function getCasaNome(ctx: Context, casaId?: string): string | undefined {
  if (!casaId) return undefined
  const casas = casasCache.get(ctx.chat!.id)
  return casas?.find(c => c.id === casaId)?.nome
}

/** Adicionar linhas de casa/funil ao texto da view */
function appendCasaFunilInfo(texto: string, pagina: any, ctx: Context): string {
  const casaNome = getCasaNome(ctx, pagina.casa_id)
  if (casaNome) texto += `🏠 Casa: *${casaNome}*\n`
  if (pagina.funil) texto += `📊 Funil: *${pagina.funil}*\n`
  if (casaNome || pagina.funil) texto += '\n'
  return texto
}

function showWhatsappView(ctx: Context, pagina: any, paginaIdx: number) {
  const dests = pagina.destinations ?? []
  let texto = `📄 *${pagina.nome}*\n`
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n`
  texto = appendCasaFunilInfo(texto, pagina, ctx)

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
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n`
  texto = appendCasaFunilInfo(texto, pagina, ctx)
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
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n`
  texto = appendCasaFunilInfo(texto, pagina, ctx)

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
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n`
  texto = appendCasaFunilInfo(texto, pagina, ctx)

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
