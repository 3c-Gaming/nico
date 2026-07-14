import { NextResponse } from 'next/server'
import { Bot } from 'grammy'

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const TOKEN = process.env.TELEGRAM_BOT_TOKEN

let bot: Bot | null = null

function getBot(): Bot {
  if (!bot && TOKEN) {
    bot = new Bot(TOKEN, {
      botInfo: {
        id: 8868340783,
        is_bot: true,
        first_name: 'Nico',
        username: 'nico_3c_bot',
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
      },
    })

    // Registrar handlers inline
    const { handleStart, handleMenu } = require('@/lib/telegram/handlers/start')
    const { handleListarPaginas, handleVerPagina } = require('@/lib/telegram/handlers/paginas')
    const { handleEditarNumero, handleSelecionarNumero, handleConfirmar, handleCancelar } = require('@/lib/telegram/handlers/editar')

    bot.command('start', handleStart)

    bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data
      const parts = data.split(':')

      if (data === 'pg:menu') return handleMenu(ctx)
      if (data === 'pg:list') return handleListarPaginas(ctx)

      if (parts[0] === 'pg') {
        switch (parts[1]) {
          case 'v': return handleVerPagina(ctx, parseInt(parts[2]))
          case 'e': return handleEditarNumero(ctx, parseInt(parts[2]), parseInt(parts[3]))
          case 'n': return handleSelecionarNumero(ctx, parseInt(parts[2]), parseInt(parts[3]), parts[4])
          case 'ok': return handleConfirmar(ctx, parseInt(parts[2]))
          case 'c': return handleCancelar(ctx, parseInt(parts[2]))
        }
      }

      await ctx.answerCallbackQuery('Ação desconhecida')
    })
  }
  return bot!
}

export async function POST(req: Request) {
  try {
    // Validar secret
    if (SECRET) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token')
      if (headerSecret !== SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const b = getBot()
    if (!b) {
      console.error('[telegram.webhook] TELEGRAM_BOT_TOKEN não configurado')
      return NextResponse.json({ ok: true })
    }

    const update = await req.json()
    await b.handleUpdate(update)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telegram.webhook] erro:', err)
    // Sempre 200 para evitar que o Telegram reenvie
    return NextResponse.json({ ok: true })
  }
}
