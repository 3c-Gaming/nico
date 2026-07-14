import { Context } from 'grammy'
import { listaPaginas, detalhesPagina, detalhesRedirectUrl, detalhesLeadFlow, detalhesRedirectConfig } from '../keyboards'
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
  let texto = `📄 *${pagina.nome}* (direto)\n`
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n`
  texto += `📝 \`${pagina.tracking_file}\`\n\n`
  texto += `🔗 *Redirect URL:*\n\`${url || 'não encontrada'}\`\n\n`
  texto += '_Clique para editar:_'

  return Promise.all([
    ctx.editMessageText(texto, {
      reply_markup: detalhesRedirectUrl(paginaIdx),
      parse_mode: 'Markdown',
    }),
    ctx.answerCallbackQuery(),
  ])
}

function showLeadFlowView(ctx: Context, pagina: any, paginaIdx: number, content: string) {
  const config = extractLeadFlowConfig(content)
  let texto = `📄 *${pagina.nome}* (formulário)\n`
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n`
  texto += `📝 \`${pagina.tracking_file}\`\n\n`

  if (!config) {
    texto += '_LEAD\\_FLOW\\_CONFIG não encontrado_'
    return Promise.all([
      ctx.editMessageText(texto, { parse_mode: 'Markdown' }),
      ctx.answerCallbackQuery(),
    ])
  }

  texto += `📊 *spreadsheetId:* \`${config.spreadsheetId}\`\n`
  texto += `📋 *sheetTab:* \`${config.sheetTab}\`\n`
  texto += `🔗 *redirectUrl:* \`${config.redirectUrl}\`\n`
  texto += `🔘 *ctaLabel:* \`${config.ctaLabel}\`\n`
  texto += `⏳ *ctaLoadingLabel:* \`${config.ctaLoadingLabel}\`\n\n`
  texto += '_Clique num campo para editar:_'

  const campos = ['redirectUrl', 'spreadsheetId', 'sheetTab', 'ctaLabel', 'ctaLoadingLabel']

  return Promise.all([
    ctx.editMessageText(texto, {
      reply_markup: detalhesLeadFlow(paginaIdx, campos),
      parse_mode: 'Markdown',
    }),
    ctx.answerCallbackQuery(),
  ])
}

function showRedirectConfigView(ctx: Context, pagina: any, paginaIdx: number, content: string) {
  const config = extractRedirectConfig(content)
  let texto = `📄 *${pagina.nome}* (formulário/redirect)\n`
  texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n`
  texto += `📝 \`${pagina.tracking_file}\`\n\n`

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
  texto += '_Clique num campo para editar:_'

  const campos = ['baseUrl', 'lpage', 'siteId', 's1']

  return Promise.all([
    ctx.editMessageText(texto, {
      reply_markup: detalhesRedirectConfig(paginaIdx, campos),
      parse_mode: 'Markdown',
    }),
    ctx.answerCallbackQuery(),
  ])
}
