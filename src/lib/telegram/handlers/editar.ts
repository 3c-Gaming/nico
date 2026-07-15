import { Context } from 'grammy'
import { listaNumeros, listaFluxos, confirmacao, menuPrincipal } from '../keyboards'
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
      `📞 *Selecione o novo número* para o destino ${destIndex + 1}:`,
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

    // Salvar phone no estado (flowId será escolhido no próximo passo)
    estadosEdicao.set(chatId, {
      paginaId: paginas[paginaIdx].id,
      destIndex,
      novoPhone: numero.numero,
      novoFlowId: '',
      novoFlowNome: '',
    })

    // Buscar fluxos disponíveis para esse número
    const fluxos = await listarFluxos(botId)
    const ativos = fluxos.filter(f => f.status === 'ativo')
    const inativos = fluxos.filter(f => f.status !== 'ativo')

    if (fluxos.length === 0) {
      await ctx.editMessageText(
        `❌ Nenhum fluxo encontrado para *${numero.nome}* (${numero.numero})`,
        { reply_markup: menuPrincipal(), parse_mode: 'Markdown' }
      )
      await ctx.answerCallbackQuery()
      return
    }

    // Mostrar lista de fluxos (ativos primeiro, depois inativos)
    const todosFluxos = [...ativos, ...inativos]

    await ctx.editMessageText(
      `🔀 *Selecione o fluxo* para *${numero.nome}*:\n📞 \`${numero.numero}\``,
      { reply_markup: listaFluxos(todosFluxos, paginaIdx, destIndex), parse_mode: 'Markdown' }
    )
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleSelecionarNumero:', err)
    await ctx.answerCallbackQuery('Erro ao carregar fluxos')
  }
}

export async function handleSelecionarFluxo(ctx: Context, paginaIdx: number, destIndex: number, flowId: string) {
  try {
    const chatId = ctx.chat!.id
    const estado = estadosEdicao.get(chatId)
    if (!estado) {
      await ctx.answerCallbackQuery('Erro: selecione um número primeiro')
      return
    }

    const paginas = paginasCache.get(chatId)
    if (!paginas || !paginas[paginaIdx]) {
      await ctx.answerCallbackQuery('Erro: página não encontrada')
      return
    }

    // Buscar nome do fluxo
    const numeros = await listarNumeros()
    const numero = numeros.find(n => n.numero === estado.novoPhone)
    let flowNome = '...' + flowId.slice(-8)
    if (numero) {
      const fluxos = await listarFluxos(numero.id)
      const fluxo = fluxos.find(f => f.id === flowId)
      if (fluxo) flowNome = fluxo.nome
    }

    // Atualizar estado com flowId e nome
    estado.novoFlowId = flowId
    estado.novoFlowNome = flowNome
    estadosEdicao.set(chatId, estado)

    const pagina = paginas[paginaIdx]
    const destAtual = pagina.destinations[destIndex]
    const flowAtualShort = destAtual.flowId ? '...' + destAtual.flowId.slice(-8) : 'nenhum'

    let texto = `⚠️ *Confirmar alteração?*\n\n`
    texto += `📄 Página: *${pagina.nome}*\n`
    texto += `📍 Destino ${destIndex + 1}\n\n`
    texto += `*Antes:*\n`
    texto += `📞 \`${destAtual.phone}\`\n#  \`${flowAtualShort}\`\n\n`
    texto += `*Depois:*\n`
    texto += `📞 \`${estado.novoPhone}\`\n🔀 ${flowNome}\n#  \`...${flowId.slice(-8)}\`\n`

    await ctx.editMessageText(texto, {
      reply_markup: confirmacao(paginaIdx),
      parse_mode: 'Markdown',
    })
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleSelecionarFluxo:', err)
    await ctx.answerCallbackQuery('Erro ao selecionar fluxo')
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

    // Commit no GitHub (usar tracking_file dinâmico)
    const token = await getGhToken()
    const filePath = pagina.tracking_file || 'src/components/tracking-whatsapp.tsx'
    const { content, sha } = await fetchFileWithSha(token, pagina.github_owner, pagina.github_repo, filePath)
    if (!content || !sha) throw new Error('Arquivo não encontrado no GitHub')

    const newContent = replaceDestinations(content, newDests)
    await commitFile(token, pagina.github_owner, pagina.github_repo, filePath, newContent, sha,
      `chore: trocar dest ${estado.destIndex + 1} via Telegram`)

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

    const flowShort = '...' + estado.novoFlowId.slice(-8)

    // Link de deploy no Lovable
    let deployMsg = ''
    if (pagina.lovable_project_id) {
      const { getDeployMessage } = await import('@/lib/paginas/lovable-deploy')
      deployMsg = getDeployMessage(pagina.lovable_project_id)
    }

    await ctx.editMessageText(
      `✅ *Alteração commitada com sucesso!*\n\n📄 ${pagina.nome}\n📞 \`${estado.novoPhone}\`\n🔀 ${estado.novoFlowNome}\n#  \`${flowShort}\`${deployMsg}`,
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
