import { bot } from './bot'
import { handleStart, handleMenu } from './handlers/start'
import { handleListarPaginas, handleVerPagina } from './handlers/paginas'
import { handleEditarNumero, handleSelecionarNumero, handleConfirmar, handleCancelar } from './handlers/editar'

// Comando /start
bot.command('start', handleStart)

// Router de callbacks
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data
  const parts = data.split(':')

  if (data === 'pg:menu') return handleMenu(ctx)
  if (data === 'pg:list') return handleListarPaginas(ctx)

  if (parts[0] === 'pg') {
    switch (parts[1]) {
      case 'v': // view page
        return handleVerPagina(ctx, parseInt(parts[2]))
      case 'e': // edit destination
        return handleEditarNumero(ctx, parseInt(parts[2]), parseInt(parts[3]))
      case 'n': // select number
        return handleSelecionarNumero(ctx, parseInt(parts[2]), parseInt(parts[3]), parts[4])
      case 'ok': // confirm
        return handleConfirmar(ctx, parseInt(parts[2]))
      case 'c': // cancel
        return handleCancelar(ctx, parseInt(parts[2]))
    }
  }

  await ctx.answerCallbackQuery('Ação desconhecida')
})
