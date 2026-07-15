import { Context } from 'grammy'
import { confirmacaoConfig, menuPrincipal } from '../keyboards'
import { estadosEdicaoConfig, paginasCache } from '../types'
import {
  getGhToken, fetchFileFromGitHub, fetchFileWithSha, commitFile,
  extractRedirectUrl, replaceRedirectUrl,
  extractLeadFlowConfig, replaceLeadFlowConfig,
  extractRedirectConfig, replaceRedirectConfig,
} from '@/lib/paginas/github-sync'

/** Atualizar um query param individual numa URL */
function updateUrlParam(urlStr: string, paramName: string, newValue: string): string {
  try {
    // Detectar se params estão no hash (#/home?...) ou na query string normal
    const hashIdx = urlStr.indexOf('#')
    const qIdx = urlStr.indexOf('?')

    if (qIdx === -1) return urlStr // sem params

    const base = urlStr.slice(0, qIdx)
    const hashAndQuery = urlStr.slice(qIdx)

    // Separar hash part se existir entre base e query
    let prefix = ''
    let queryStr = hashAndQuery
    if (hashIdx !== -1 && hashIdx < qIdx) {
      prefix = urlStr.slice(hashIdx, qIdx)
      queryStr = urlStr.slice(qIdx)
    }

    const params = new URLSearchParams(queryStr.slice(1))
    params.set(paramName, newValue)

    if (prefix) {
      return urlStr.slice(0, hashIdx) + prefix + '?' + params.toString()
    }
    return base + '?' + params.toString()
  } catch {
    return urlStr
  }
}

/** Extrair valor de um param de uma URL */
function getUrlParam(urlStr: string, paramName: string): string {
  try {
    const qIdx = urlStr.indexOf('?')
    if (qIdx === -1) return ''
    const params = new URLSearchParams(urlStr.slice(qIdx + 1))
    return params.get(paramName) || ''
  } catch {
    return ''
  }
}

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
    let displayCampo = campo

    // Campo url:paramName = editar parâmetro individual da URL
    if (campo.startsWith('url:')) {
      const paramName = campo.slice(4)
      displayCampo = paramName
      // Determinar qual URL contém o param
      if (pagina.tracking_file.includes('leadFlow')) {
        const config = extractLeadFlowConfig(content)
        valorAtual = config ? getUrlParam(config.redirectUrl, paramName) : ''
      } else {
        const url = extractRedirectUrl(content)
        valorAtual = getUrlParam(url, paramName)
      }
    } else if (campo === 'redirectUrl' && pagina.tracking_file.includes('leadFlow')) {
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
      `✏️ *Editar ${displayCampo}*\n\n📄 Página: *${pagina.nome}*\n\n` +
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

  const displayCampo = estado.campo.startsWith('url:') ? estado.campo.slice(4) : estado.campo

  let texto = `⚠️ *Confirmar alteração?*\n\n`
  texto += `📄 Página: *${pagina.nome}*\n`
  texto += `📝 Campo: *${displayCampo}*\n\n`
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

    if (estado.campo.startsWith('url:')) {
      // Edição de parâmetro individual da URL
      const paramName = estado.campo.slice(4)
      if (pagina.tracking_file!.includes('leadFlow')) {
        const config = extractLeadFlowConfig(content)
        if (!config) throw new Error('LEAD_FLOW_CONFIG não encontrado')
        config.redirectUrl = updateUrlParam(config.redirectUrl, paramName, estado.valorAtual)
        newContent = replaceLeadFlowConfig(content, config)
      } else {
        const oldUrl = extractRedirectUrl(content)
        const newUrl = updateUrlParam(oldUrl, paramName, estado.valorAtual)
        newContent = replaceRedirectUrl(content, newUrl)
      }
    } else if (pagina.tracking_file!.includes('leadFlow')) {
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
      // redirectUrl inteira (useRedirectUrl.ts ou TrackingRedirect.tsx)
      newContent = replaceRedirectUrl(content, estado.valorAtual)
    }

    const displayCampo = estado.campo.startsWith('url:') ? estado.campo.slice(4) : estado.campo
    await commitFile(token, pagina.github_owner, pagina.github_repo, pagina.tracking_file!, newContent, sha,
      `chore: atualizar ${displayCampo} via Telegram`)

    estadosEdicaoConfig.delete(chatId)

    // Link de deploy no Lovable
    let deployMsg = ''
    if (pagina.lovable_project_id) {
      const { getDeployMessage } = await import('@/lib/paginas/lovable-deploy')
      deployMsg = getDeployMessage(pagina.lovable_project_id)
    }

    await ctx.editMessageText(
      `✅ *Alteração commitada com sucesso!*\n\n` +
      `📄 ${pagina.nome}\n` +
      `📝 ${displayCampo}: \`${estado.valorAtual}\`${deployMsg}`,
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
