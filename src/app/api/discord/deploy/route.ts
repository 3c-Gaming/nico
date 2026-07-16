import { NextResponse } from 'next/server'
import { DISCORD_COMMANDS } from '@/lib/discord/commands'

const DISCORD_API = 'https://discord.com/api/v10'

export async function POST() {
  const token = process.env.DISCORD_BOT_TOKEN
  const applicationId = process.env.DISCORD_CLIENT_ID
  const guildId = process.env.DISCORD_GUILD_ID

  if (!token || !applicationId) {
    return NextResponse.json(
      { error: 'DISCORD_BOT_TOKEN ou DISCORD_CLIENT_ID não configurados' },
      { status: 500 }
    )
  }

  const headers = {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  }

  try {
    if (guildId) {
      const res = await fetch(
        `${DISCORD_API}/applications/${applicationId}/guilds/${guildId}/commands`,
        { method: 'PUT', headers, body: JSON.stringify(DISCORD_COMMANDS) }
      )
      if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
      const data = await res.json()
      return NextResponse.json({ ok: true, scope: 'guild', guildId, commands: data })
    }

    const res = await fetch(
      `${DISCORD_API}/applications/${applicationId}/commands`,
      { method: 'PUT', headers, body: JSON.stringify(DISCORD_COMMANDS) }
    )
    if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return NextResponse.json({ ok: true, scope: 'global', commands: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
