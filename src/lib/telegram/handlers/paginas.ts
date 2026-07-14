import { Context } from 'grammy'
import { listaPaginas, detalhesPagina } from '../keyboards'
import { paginasCache } from '../types'

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
    const dests = pagina.destinations ?? []

    let texto = `📄 *${pagina.nome}*\n`
    texto += `📦 \`${pagina.github_owner}/${pagina.github_repo}\`\n\n`

    if (dests.length === 0) {
      texto += '_Nenhum destination configurado_'
    } else {
      texto += '*Destinos:*\n'
      dests.forEach((d, i) => {
        const flowShort = d.flowId ? d.flowId.slice(0, 8) + '...' : 'sem flow'
        texto += `${i + 1}. 📞 \`${d.phone}\` · # \`${flowShort}\` · ${d.weight}%\n`
      })
      texto += '\n_Clique num destino para editar:_'
    }

    await ctx.editMessageText(texto, {
      reply_markup: detalhesPagina(paginaIdx, dests),
      parse_mode: 'Markdown',
    })
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleVerPagina:', err)
    await ctx.answerCallbackQuery('Erro ao ver página')
  }
}
