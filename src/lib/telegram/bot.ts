import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.warn('[telegram] TELEGRAM_BOT_TOKEN não configurado')
}

const globalForBot = globalThis as unknown as { telegramBot: Bot | undefined }

if (!globalForBot.telegramBot && token) {
  globalForBot.telegramBot = new Bot(token)
}

export const bot = globalForBot.telegramBot!
