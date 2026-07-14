import { Context } from 'grammy'
import { listaNumeros, confirmacao, menuPrincipal } from '../keyboards'
import { estadosEdicao, paginasCache } from '../types'
import { listarNumeros, listarFluxos } from '@/lib/integrações/sendpulse'
import { getGhToken, fetchFileWithSha, replaceDestinations, commitFile } from '@/lib/paginas/github-sync'

export async function handleEditarNumero(ctx: Context, paginaIdx: number, destIndex: number) {
  try {
    const numeros = await listarNumeros()
    const ativos = numeros.filter(n => n.status === 'ativo')

    if (ativos.length === 0) {
      await ctx.answerCallbackQuery('Nenhum número ativo encontrado')
      return
    }

    await ctx.editMessageText(
      `📞 *Selecione o novo número* para o destination ${destIndex + 1}:`,
      { reply_markup: listaNumeros(ativos, paginaIdx, destIndex), parse_mode: 'Markdown' }
    )
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleEditarNumero:', err)
    await ctx.answerCallbackQuery('Erro ao carregar números')
  }
}

export async function handleSelecionarNumero(ctx: Context, paginaIdx: number, destIndex: number, botId: string) {
  try {
    const chatId = ctx.chat!.id
    const paginas = paginasCache.get(chatId)
    if (!paginas || !paginas[paginaIdx]) {
      await ctx.answerCallbackQuery('Erro: página não encontrada')
      return
    }

    // Buscar dados do número selecionado
    const numeros = await listarNumeros()
    const numero = numeros.find(n => n.id === botId)
    if (!numero) {
      await ctx.answerCallbackQuery('Número não encontrado')
      return
    }

    // Auto-buscar flowId
    const fluxos = await listarFluxos(botId)
    const fluxoAtivo = fluxos.find(f => f.status === 'ativo')
    const flowId = fluxoAtivo?.id ?? ''

    // Salvar estado
    estadosEdicao.set(chatId, {
      paginaId: paginas[paginaIdx].id,
      destIndex,
      novoPhone: numero.numero,
      novoFlowId: flowId,
    })

    const pagina = paginas[paginaIdx]
    const destAtual = pagina.destinations[destIndex]

    let texto = `⚠️ *Confirmar alteração?*\n\n`
    texto += `📄 Página: *${pagina.nome}*\n`
    texto += `📍 Destination ${destIndex + 1}\n\n`
    texto += `*Antes:*\n`
    texto += `📞 \`${destAtual.phone}\`\nFlow: \`${destAtual.flowId}\`\n\n`
    texto += `*Depois:*\n`
    texto += `📞 \`${numero.numero}\`\nFlow: \`${flowId || '(nenhum fluxo ativo)'}\`\n`

    await ctx.editMessageText(texto, {
      reply_markup: confirmacao(paginaIdx),
      parse_mode: 'Markdown',
    })
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleSelecionarNumero:', err)
    await ctx.answerCallbackQuery('Erro ao selecionar número')
  }
}

export async function handleConfirmar(ctx: Context, paginaIdx: number) {
  const chatId = ctx.chat!.id
  const estado = estadosEdicao.get(chatId)
  if (!estado) {
    await ctx.answerCallbackQuery('Nenhuma edição pendente')
    return
  }

  const paginas = paginasCache.get(chatId)
  if (!paginas || !paginas[paginaIdx]) {
    await ctx.answerCallbackQuery('Erro: página não encontrada')
    return
  }

  const pagina = paginas[paginaIdx]

  try {
    await ctx.editMessageText('⏳ Commitando no GitHub...')

    // Montar novo array de destinations
    const newDests = [...pagina.destinations]
    newDests[estado.destIndex] = {
      ...newDests[estado.destIndex],
      phone: estado.novoPhone,
      flowId: estado.novoFlowId,
    }

    // Commit no GitHub
    const token = await getGhToken()
    const filePath = 'src/components/tracking-whatsapp.tsx'
    const { content, sha } = await fetchFileWithSha(token, pagina.github_owner, pagina.github_repo, filePath)
    if (!content || !sha) throw new Error('Arquivo não encontrado no GitHub')

    const newContent = replaceDestinations(content, newDests)
    await commitFile(token, pagina.github_owner, pagina.github_repo, filePath, newContent, sha,
      `chore: trocar número dest ${estado.destIndex + 1} via Telegram`)

    // Atualizar Supabase
    try {
      const { getSupabase } = await import('@/lib/db/supabase')
      const sb = getSupabase()
      if (sb) {
        await (sb.from('paginas') as any).update({
          destinations: newDests,
          updated_at: new Date().toISOString(),
        }).eq('id', pagina.id)
      }
    } catch { /* não crítico */ }

    // Atualizar cache
    pagina.destinations = newDests
    estadosEdicao.delete(chatId)

    await ctx.editMessageText(
      `✅ *Alteração commitada com sucesso!*\n\n📄 ${pagina.nome}\n📞 Novo número: \`${estado.novoPhone}\`\nFlow: \`${estado.novoFlowId}\``,
      { reply_markup: menuPrincipal(), parse_mode: 'Markdown' }
    )
  } catch (err) {
    console.error('[telegram] handleConfirmar:', err)
    await ctx.editMessageText(
      `❌ Erro ao commitar: ${(err as Error).message}`,
      { reply_markup: menuPrincipal() }
    )
  }

  await ctx.answerCallbackQuery()
}

export async function handleCancelar(ctx: Context, paginaIdx: number) {
  const chatId = ctx.chat!.id
  estadosEdicao.delete(chatId)

  // Voltar para view da página
  const paginas = paginasCache.get(chatId)
  if (paginas && paginas[paginaIdx]) {
    const { handleVerPagina } = await import('./paginas')
    return handleVerPagina(ctx, paginaIdx)
  }

  await ctx.answerCallbackQuery('Edição cancelada')
}
