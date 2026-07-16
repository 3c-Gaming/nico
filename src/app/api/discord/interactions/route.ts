import { NextRequest, NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import {
  handleStatus,
  handleFluxos,
  handleTestar,
  handleRelatorio,
  handleAjuda,
} from '@/lib/discord/handlers'

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY

function verifySignature(
  timestamp: string,
  body: string,
  signature: string
): boolean {
  if (!DISCORD_PUBLIC_KEY) return false

  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      Buffer.from(signature, 'hex'),
      Buffer.from(DISCORD_PUBLIC_KEY, 'hex')
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const timestamp = request.headers.get('X-Signature-Timestamp') ?? ''
  const signature = request.headers.get('X-Signature-Ed25519') ?? ''
  const body = await request.text()

  if (!verifySignature(timestamp, body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const interaction = JSON.parse(body)

  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 })
  }

  if (interaction.type === 2) {
    const { name } = interaction.data

    const { InteractionResponseType } = await import('discord-api-types/v10')

    const reply = async (payload: Record<string, unknown>) => {
      return NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: payload,
      })
    }

    const deferReply = async () => {
      return NextResponse.json({
        type: InteractionResponseType.DeferredChannelMessageWithSource,
      })
    }

    const editReply = async (payload: Record<string, unknown>) => {
      return NextResponse.json({
        type: InteractionResponseType.UpdateMessage,
        data: payload,
      })
    }

    const interactionLike = {
      options: {
        getString: (name: string, required: boolean): string | null => {
          const opt = interaction.data.options?.find(
            (o: { name: string; type: number }) => o.name === name
          )
          if (!opt && required) return null
          return (opt?.value as string) ?? null
        },
      },
      deferReply,
      editReply,
      reply,
    }

    switch (name) {
      case 'status':
        await handleStatus(interactionLike as never)
        break
      case 'fluxos':
        await handleFluxos(interactionLike as never)
        break
      case 'testar':
        await handleTestar(interactionLike as never)
        break
      case 'relatorio':
        await handleRelatorio(interactionLike as never)
        break
      case 'ajuda':
        await handleAjuda(interactionLike as never)
        break
      default:
        return NextResponse.json(
          { error: 'Unknown command' },
          { status: 400 }
        )
    }

    return NextResponse.json({ type: 6 })
  }

  return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 })
}
