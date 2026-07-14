import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.warn('[telegram] TELEGRAM_BOT_TOKEN não configurado')
}

const globalForBot = globalThis as unknown as { telegramBot: Bot | undefined }

if (!globalForBot.telegramBot && token) {
  globalForBot.telegramBot = new Bot(token, {
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

export const bot = globalForBot.telegramBot!
