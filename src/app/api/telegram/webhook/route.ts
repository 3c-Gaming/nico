import { NextResponse } from 'next/server'
import { Bot } from 'grammy'

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const TOKEN = process.env.TELEGRAM_BOT_TOKEN

let bot: Bot | null = null
let handlersRegistered = false

async function getBot(): Promise<Bot> {
  if (!bot && TOKEN) {
    bot = new Bot(TOKEN, {
      botInfo: {
        id: 8868340783,
        is_bot: true as const,
        first_name: 'Nico',
        username: 'nico_3c_bot',
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        can_connect_to_business: false,
        has_main_web_app: false,
        has_topics_enabled: false,
        allows_users_to_create_topics: false,
        can_manage_bots: false,
        supports_join_request_queries: false,
        supports_guest_queries: false,
      },
    })
  }

  if (bot && !handlersRegistered) {
    handlersRegistered = true

    const { handleStart, handleMenu } = await import('@/lib/telegram/handlers/start')
    const { handleListarPaginas, handleListarCasas, handleListarPorCasa, handleVerPagina } = await import('@/lib/telegram/handlers/paginas')
    const { handleEditarNumero, handleSelecionarNumero, handleSelecionarFluxo, handleConfirmar, handleCancelar } = await import('@/lib/telegram/handlers/editar')
    const { handleEditarCampo, handleTextoRecebido, handleConfirmarConfig, handleCancelarConfig } = await import('@/lib/telegram/handlers/editar-config')

    bot.command('start', handleStart)

    bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data
      const parts = data.split(':')

      if (data === 'pg:menu') return handleMenu(ctx)
      if (data === 'pg:list') return handleListarPaginas(ctx)
      if (data === 'pg:casas') return handleListarCasas(ctx)

      if (parts[0] === 'pg') {
        switch (parts[1]) {
          case 'v': return handleVerPagina(ctx, parseInt(parts[2]))
          case 'e': return handleEditarNumero(ctx, parseInt(parts[2]), parseInt(parts[3]))
          case 'n': return handleSelecionarNumero(ctx, parseInt(parts[2]), parseInt(parts[3]), parts[4])
          case 'f': return handleSelecionarFluxo(ctx, parseInt(parts[2]), parseInt(parts[3]), parts[4])
          case 'ok': return handleConfirmar(ctx, parseInt(parts[2]))
          case 'c': return handleCancelar(ctx, parseInt(parts[2]))
          case 'lc': return handleListarPorCasa(ctx, parts.slice(2).join(':'))
          case 'ec': return handleEditarCampo(ctx, parseInt(parts[2]), parts.slice(3).join(':'))
          case 'okc': return handleConfirmarConfig(ctx, parseInt(parts[2]))
          case 'cc': return handleCancelarConfig(ctx, parseInt(parts[2]))
          default:
            return ctx.answerCallbackQuery()
        }
      }

      await ctx.answerCallbackQuery()
    })

    bot.on('message:text', async (ctx) => {
      if (ctx.message.text.startsWith('/')) return
      await handleTextoRecebido(ctx)
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

    const b = await getBot()
    if (!b) {
      console.error('[telegram.webhook] TELEGRAM_BOT_TOKEN não configurado')
      return NextResponse.json({ ok: true })
    }

    const update = await req.json()
    await b.handleUpdate(update)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telegram.webhook] erro:', err)
    return NextResponse.json({ ok: true })
  }
}
