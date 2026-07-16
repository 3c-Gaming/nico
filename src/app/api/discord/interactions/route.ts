import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { verifyInteractionSignature, replyToInteraction, ResponseType } from '@/lib/discord/verify'
import { dispatchCommand } from '@/lib/discord/handlers'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const timestamp = request.headers.get('X-Signature-Timestamp') ?? ''
  const signature = request.headers.get('X-Signature-Ed25519') ?? ''
  const body = await request.text()

  const isValid = await verifyInteractionSignature(timestamp, body, signature)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const interaction = JSON.parse(body)

  if (interaction.type === 1) {
    return NextResponse.json({ type: ResponseType.PONG })
  }

  if (interaction.type === 2) {
    const applicationId = process.env.DISCORD_CLIENT_ID
    if (!applicationId) {
      return NextResponse.json({ error: 'DISCORD_CLIENT_ID não configurado' }, { status: 500 })
    }

    const { name, options } = interaction.data

    const reply = async (payload: { embeds?: unknown[]; content?: string }) => {
      await replyToInteraction(applicationId, interaction.token, payload)
    }

    waitUntil(dispatchCommand(name, options, reply))

    return NextResponse.json({ type: ResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
  }

  return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 })
}
