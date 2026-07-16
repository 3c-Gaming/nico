import { NextResponse } from 'next/server'
import { REST, Routes } from 'discord.js'
import { commands } from '@/lib/discord/commands'

const token = process.env.DISCORD_BOT_TOKEN
const applicationId = process.env.DISCORD_CLIENT_ID
const guildId = process.env.DISCORD_GUILD_ID

export async function POST() {
  if (!token || !applicationId) {
    return NextResponse.json(
      { error: 'DISCORD_BOT_TOKEN ou DISCORD_APPLICATION_ID não configurados' },
      { status: 500 }
    )
  }

  const rest = new REST({ version: '10' }).setToken(token)

  try {
    const commandData = commands.map(cmd => cmd.toJSON())

    if (guildId) {
      const data = await rest.put(
        Routes.applicationGuildCommands(applicationId, guildId),
        { body: commandData }
      )
      return NextResponse.json({
        ok: true,
        scope: 'guild',
        guildId,
        commands: data,
      })
    }

    const data = await rest.put(Routes.applicationCommands(applicationId), {
      body: commandData,
    })

    return NextResponse.json({
      ok: true,
      scope: 'global',
      commands: data,
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
