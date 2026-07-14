import { NextResponse } from 'next/server'

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

export async function POST(req: Request) {
  try {
    // Validar secret
    if (SECRET) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token')
      if (headerSecret !== SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Import dinâmico para registrar handlers apenas quando necessário
    const { bot } = await import('@/lib/telegram/bot')
    await import('@/lib/telegram/handlers')

    // Inicializar bot (necessário em ambiente serverless antes de handleUpdate)
    if (!bot.isInited()) await bot.init()

    const update = await req.json()
    await bot.handleUpdate(update)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telegram.webhook] erro:', err)
    // Sempre 200 para evitar que o Telegram reenvie
    return NextResponse.json({ ok: true })
  }
}
