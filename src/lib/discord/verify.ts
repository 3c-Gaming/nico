const DISCORD_API = 'https://discord.com/api/v10'

export async function verifyInteractionSignature(
  timestamp: string,
  body: string,
  signature: string
): Promise<boolean> {
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey) return false

  const encoder = new TextEncoder()
  const data = encoder.encode(timestamp + body)

  const keyBuffer = hexToBytes(publicKey)
  const sigBuffer = hexToBytes(signature)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer.buffer as ArrayBuffer,
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    false,
    ['verify']
  )

  return crypto.subtle.verify('Ed25519', cryptoKey, sigBuffer.buffer as ArrayBuffer, data.buffer as ArrayBuffer)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

export async function replyToInteraction(
  applicationId: string,
  interactionToken: string,
  payload: { embeds?: unknown[]; content?: string }
) {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error('DISCORD_BOT_TOKEN não configurado')

  const res = await fetch(
    `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sendChannelMessage(channelId: string, payload: { embeds?: unknown[]; content?: string }) {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error('DISCORD_BOT_TOKEN não configurado')

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`)
  return res.json()
}

export const ResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
} as const
