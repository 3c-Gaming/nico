import { Context } from 'grammy'
import { confirmacaoConfig, menuPrincipal } from '../keyboards'
import { estadosEdicaoConfig, paginasCache } from '../types'
import {
  getGhToken, fetchFileFromGitHub, fetchFileWithSha, commitFile,
  extractRedirectUrl, replaceRedirectUrl,
  extractLeadFlowConfig, replaceLeadFlowConfig,
  extractRedirectConfig, replaceRedirectConfig,
} from '@/lib/paginas/github-sync'

export async function handleEditarCampo(ctx: Context, paginaIdx: number, campo: string) {
  try {
    const chatId = ctx.chat!.id
    const paginas = paginasCache.get(chatId)
    if (!paginas || !paginas[paginaIdx]) {
      await ctx.answerCallbackQuery('Erro: página não encontrada')
      return
    }

    const pagina = paginas[paginaIdx]
    if (!pagina.tracking_file) {
      await ctx.answerCallbackQuery('Sem arquivo de tracking')
      return
    }

    // Buscar valor atual do campo
    const token = await getGhToken()
    const content = await fetchFileFromGitHub(token, pagina.github_owner, pagina.github_repo, pagina.tracking_file)
    if (!content) {
      await ctx.answerCallbackQuery('Arquivo não encontrado no GitHub')
      return
    }

    let valorAtual = ''

    if (campo === 'redirectUrl' && pagina.tracking_file.includes('leadFlow')) {
      const config = extractLeadFlowConfig(content)
      valorAtual = config?.redirectUrl || ''
    } else if (campo === 'redirectUrl') {
      valorAtual = extractRedirectUrl(content)
    } else if (['spreadsheetId', 'sheetTab', 'ctaLabel', 'ctaLoadingLabel'].includes(campo)) {
      const config = extractLeadFlowConfig(content)
      valorAtual = config?.[campo as keyof typeof config] || ''
    } else if (['baseUrl', 'lpage', 'siteId', 's1'].includes(campo)) {
      const config = extractRedirectConfig(content)
      valorAtual = config?.[campo as keyof typeof config] || ''
    }

    // Salvar estado
    estadosEdicaoConfig.set(chatId, {
      paginaId: pagina.id,
      paginaIdx,
      campo,
      valorAtual,
    })

    await ctx.editMessageText(
      `✏️ *Editar ${campo}*\n\n📄 Página: *${pagina.nome}*\n\n` +
      `*Valor atual:*\n\`${valorAtual || '(vazio)'}\`\n\n` +
      `📝 *Digite o novo valor:*`,
      { parse_mode: 'Markdown' }
    )
    await ctx.answerCallbackQuery()
  } catch (err) {
    console.error('[telegram] handleEditarCampo:', err)
    await ctx.answerCallbackQuery('Erro ao editar campo')
  }
}

export async function handleTextoRecebido(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat!.id
  const estado = estadosEdicaoConfig.get(chatId)
  if (!estado) return false // Não há edição pendente

  const novoValor = ctx.message?.text?.trim()
  if (!novoValor) return false

  const paginas = paginasCache.get(chatId)
  if (!paginas || !paginas[estado.paginaIdx]) {
    await ctx.reply('❌ Página não encontrada. Use /start para recomeçar.')
    estadosEdicaoConfig.delete(chatId)
    return true
  }

  const pagina = paginas[estado.paginaIdx]

  // Atualizar estado com novo valor
  const valorAntigo = estado.valorAtual
  estado.valorAtual = novoValor
  estadosEdicaoConfig.set(chatId, estado)

  let texto = `⚠️ *Confirmar alteração?*\n\n`
  texto += `📄 Página: *${pagina.nome}*\n`
  texto += `📝 Campo: *${estado.campo}*\n\n`
  texto += `*Antes:*\n\`${valorAntigo || '(vazio)'}\`\n\n`
  texto += `*Depois:*\n\`${novoValor}\`\n`

  await ctx.reply(texto, {
    reply_markup: confirmacaoConfig(estado.paginaIdx),
    parse_mode: 'Markdown',
  })

  return true
}

export async function handleConfirmarConfig(ctx: Context, paginaIdx: number) {
  const chatId = ctx.chat!.id
  const estado = estadosEdicaoConfig.get(chatId)
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

    const token = await getGhToken()
    const { content, sha } = await fetchFileWithSha(token, pagina.github_owner, pagina.github_repo, pagina.tracking_file!)
    if (!content || !sha) throw new Error('Arquivo não encontrado no GitHub')

    let newContent = content

    // Aplicar a mudança conforme o tipo de arquivo
    if (pagina.tracking_file!.includes('leadFlow')) {
      const config = extractLeadFlowConfig(content)
      if (!config) throw new Error('LEAD_FLOW_CONFIG não encontrado')
      ;(config as any)[estado.campo] = estado.valorAtual
      newContent = replaceLeadFlowConfig(content, config)
    } else if (pagina.tracking_file!.includes('redirect.ts')) {
      const config = extractRedirectConfig(content)
      if (!config) throw new Error('REDIRECT_CONFIG não encontrado')
      ;(config as any)[estado.campo] = estado.valorAtual
      newContent = replaceRedirectConfig(content, config)
    } else {
      // redirectUrl (useRedirectUrl.ts ou TrackingRedirect.tsx)
      newContent = replaceRedirectUrl(content, estado.valorAtual)
    }

    await commitFile(token, pagina.github_owner, pagina.github_repo, pagina.tracking_file!, newContent, sha,
      `chore: atualizar ${estado.campo} via Telegram`)

    // Atualizar Supabase se for redirectUrl em destinations
    // (não aplicável para esses tipos, mas manter consistência)

    estadosEdicaoConfig.delete(chatId)

    // Deploy no Lovable se tiver project_id
    let deployMsg = ''
    if (pagina.lovable_project_id) {
      try {
        await ctx.editMessageText('⏳ Deployando no Lovable...')
        const { deployLovable } = await import('@/lib/paginas/lovable-deploy')
        const deploy = await deployLovable(pagina.lovable_project_id)
        deployMsg = `\n🚀 Deploy: [${deploy.url}](${deploy.url})`
      } catch (e) {
        deployMsg = `\n⚠️ Deploy falhou: ${(e as Error).message}`
      }
    }

    await ctx.editMessageText(
      `✅ *Alteração commitada com sucesso!*\n\n` +
      `📄 ${pagina.nome}\n` +
      `📝 ${estado.campo}: \`${estado.valorAtual}\`${deployMsg}`,
      { reply_markup: menuPrincipal(), parse_mode: 'Markdown' }
    )
  } catch (err) {
    console.error('[telegram] handleConfirmarConfig:', err)
    await ctx.editMessageText(
      `❌ Erro ao commitar: ${(err as Error).message}`,
      { reply_markup: menuPrincipal() }
    )
  }

  await ctx.answerCallbackQuery()
}

export async function handleCancelarConfig(ctx: Context, paginaIdx: number) {
  const chatId = ctx.chat!.id
  estadosEdicaoConfig.delete(chatId)

  // Voltar para view da página
  const paginas = paginasCache.get(chatId)
  if (paginas && paginas[paginaIdx]) {
    const { handleVerPagina } = await import('./paginas')
    return handleVerPagina(ctx, paginaIdx)
  }

  await ctx.answerCallbackQuery('Edição cancelada')
}
