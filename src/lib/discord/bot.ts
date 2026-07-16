import { Client, GatewayIntentBits } from 'discord.js'

const token = process.env.DISCORD_BOT_TOKEN

if (!token) {
  console.warn('[discord] DISCORD_BOT_TOKEN não configurado')
}

const globalForDiscord = globalThis as unknown as { discordClient: Client | undefined }

if (!globalForDiscord.discordClient && token) {
  globalForDiscord.discordClient = new Client({
    intents: [GatewayIntentBits.Guilds],
  })
}

export const client = globalForDiscord.discordClient!

export function getClient(): Client | null {
  if (!token) return null
  return client
}
