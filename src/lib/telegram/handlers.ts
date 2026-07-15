import { bot } from './bot'
import { handleStart, handleMenu } from './handlers/start'
import { handleListarPaginas, handleListarCasas, handleListarPorCasa, handleVerPagina } from './handlers/paginas'
import { handleEditarNumero, handleSelecionarNumero, handleSelecionarFluxo, handleConfirmar, handleCancelar } from './handlers/editar'
import { handleEditarCampo, handleTextoRecebido, handleConfirmarConfig, handleCancelarConfig } from './handlers/editar-config'

// Comando /start
bot.command('start', handleStart)

// Router de callbacks
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data
  const parts = data.split(':')

  if (data === 'pg:menu') return handleMenu(ctx)
  if (data === 'pg:list') return handleListarPaginas(ctx)
  if (data === 'pg:casas') return handleListarCasas(ctx)

  if (parts[0] === 'pg') {
    switch (parts[1]) {
      case 'v': // view page
        return handleVerPagina(ctx, parseInt(parts[2]))
      case 'e': // edit destination (whatsapp)
        return handleEditarNumero(ctx, parseInt(parts[2]), parseInt(parts[3]))
      case 'n': // select number
        return handleSelecionarNumero(ctx, parseInt(parts[2]), parseInt(parts[3]), parts[4])
      case 'f': // select flow
        return handleSelecionarFluxo(ctx, parseInt(parts[2]), parseInt(parts[3]), parts[4])
      case 'ok': // confirm (whatsapp edit)
        return handleConfirmar(ctx, parseInt(parts[2]))
      case 'c': // cancel (whatsapp edit)
        return handleCancelar(ctx, parseInt(parts[2]))
      case 'lc': // list pages by casa
        return handleListarPorCasa(ctx, parts[2])
      case 'ec': // edit config field
        return handleEditarCampo(ctx, parseInt(parts[2]), parts[3])
      case 'okc': // confirm config edit
        return handleConfirmarConfig(ctx, parseInt(parts[2]))
      case 'cc': // cancel config edit
        return handleCancelarConfig(ctx, parseInt(parts[2]))
    }
  }

  await ctx.answerCallbackQuery('Ação desconhecida')
})

// Handler de mensagem de texto (para capturar novo valor de config)
bot.on('message:text', async (ctx) => {
  // Se o texto começa com /, é um comando — não processar aqui
  if (ctx.message.text.startsWith('/')) return

  // Tentar processar como resposta de edição de config
  const handled = await handleTextoRecebido(ctx)
  if (!handled) {
    // Texto não relacionado a nenhuma edição pendente — ignorar
  }
})
