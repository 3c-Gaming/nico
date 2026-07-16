const DISCORD_API = 'https://discord.com/api/v10'

function getToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error('DISCORD_BOT_TOKEN não configurado')
  return token
}

function headers() {
  return {
    Authorization: `Bot ${getToken()}`,
    'Content-Type': 'application/json',
  }
}

export async function getApplicationCommands(applicationId: string) {
  const res = await fetch(`${DISCORD_API}/applications/${applicationId}/commands`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function putGlobalCommands(applicationId: string, commands: unknown[]) {
  const res = await fetch(`${DISCORD_API}/applications/${applicationId}/commands`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function putGuildCommands(applicationId: string, guildId: string, commands: unknown[]) {
  const res = await fetch(`${DISCORD_API}/applications/${applicationId}/guilds/${guildId}/commands`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sendMessage(channelId: string, payload: { embeds?: unknown[]; content?: string }) {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function editReply(applicationId: string, interactionToken: string, payload: { embeds?: unknown[]; content?: string }) {
  const res = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
  return res.json()
}

export const INTERACTIONResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
} as const
