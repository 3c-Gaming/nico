import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import type { WebhookPayload } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = process.env.AUTH_DIR || path.resolve(__dirname, '..', 'data', 'auth')
const WEBHOOK_FILE = path.resolve(__dirname, '..', 'data', 'webhook-config.json')

let sock: ReturnType<typeof makeWASocket> | null = null
let connectedNumber: string | undefined
let lastDisconnectReason: string | undefined
let isConnecting = false
let latestQr: string | undefined
let webhookUrl: string | undefined
let webhookSecret: string | undefined
let startAttempts = 0

const messageHandlers: ((payload: WebhookPayload) => void)[] = []

export function onMessage(handler: (payload: WebhookPayload) => void) {
  messageHandlers.push(handler)
}

async function loadWebhookConfig() {
  try {
    const data = await readFile(WEBHOOK_FILE, 'utf-8')
    const config = JSON.parse(data)
    webhookUrl = config.url
    webhookSecret = config.secret
  } catch {
    webhookUrl = process.env.WHATSAPP_WEBHOOK_URL
    webhookSecret = process.env.BRIDGE_SECRET
  }
}

export async function saveWebhookConfig(url: string, secret?: string) {
  webhookUrl = url
  webhookSecret = secret
  const dir = path.dirname(WEBHOOK_FILE)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(WEBHOOK_FILE, JSON.stringify({ url, secret }, null, 2))
}

async function sendWebhook(payload: WebhookPayload) {
  if (!webhookUrl) return
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (webhookSecret) headers['x-bridge-secret'] = webhookSecret
    await fetch(webhookUrl, { method: 'POST', headers, body: JSON.stringify(payload) })
  } catch {
    /* webhook offline */
  }
}

export async function start() {
  if (isConnecting) return
  isConnecting = true
  startAttempts++

  if (!existsSync(AUTH_DIR)) {
    await mkdir(AUTH_DIR, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log('[bridge] using wa version', version.join('.'), isLatest ? '(latest)' : '(outdated)')

  sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: process.env.LOG_LEVEL || 'silent' }),
    browser: ['Nico QA Watcher', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      try {
        const qrcode = await import('qrcode')
        latestQr = await qrcode.toDataURL(qr)
        console.log('[bridge] QR code generated')
      } catch (err) {
        console.error('[bridge] QR generation failed', err)
      }
    }

    const logParts = ['[bridge] connection.update']
    if (connection) logParts.push('connection=' + connection)
    if (qr) logParts.push('qr=yes')
    if (lastDisconnect?.error) {
      const err = lastDisconnect.error as Error
      logParts.push('error=' + (err.message?.slice(0, 120) || 'unknown'))
      if (err.stack) logParts.push('stack=' + err.stack.split('\n')[1]?.trim()?.slice(0, 100))
    }
    console.log(logParts.join(' | '))

    if (connection === 'open') {
      connectedNumber = sock?.user?.id?.split(':')[0]
      lastDisconnectReason = undefined
      latestQr = undefined
      isConnecting = false
      startAttempts = 0
    }

    if (connection === 'close') {
      const err = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
      const statusCode = err?.output?.statusCode
      const disconnected = statusCode === DisconnectReason.loggedOut
      lastDisconnectReason = disconnected ? 'logged_out' : 'connection_closed'
      connectedNumber = undefined
      isConnecting = false

      if (!disconnected && startAttempts < 10) {
        setTimeout(start, 5000)
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message?.conversation) {
        const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || ''
        const text = msg.message.conversation
        const payload: WebhookPayload = {
          from,
          text,
          timestamp: (msg.messageTimestamp as number) || Date.now(),
          messageId: msg.key.id || '',
        }
        messageHandlers.forEach((h) => h(payload))
        sendWebhook(payload)
      }
    }
  })

  await loadWebhookConfig()
}

export function getStatus() {
  return {
    connected: !!connectedNumber,
    number: connectedNumber,
    qrNeeded: !connectedNumber,
    lastDisconnectReason,
  }
}

export function getQr(): string | undefined {
  return latestQr
}

export async function resetAuth() {
  if (existsSync(AUTH_DIR)) {
    await rm(AUTH_DIR, { recursive: true, force: true })
    console.log('[bridge] auth deleted')
  }
}

export async function sendMessage(to: string, text: string, timeoutMs = 20000): Promise<string> {
  if (!sock || !connectedNumber) throw new Error('WhatsApp nao conectado')

  const jid = to.includes('@s.whatsapp.net') ? to : to + '@s.whatsapp.net'

  const messageId = await new Promise<string>((resolve, reject) => {
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        reject(new Error('Timeout: mensagem enviada mas sem confirmacao do WhatsApp (' + timeoutMs + 'ms)'))
      }
    }, timeoutMs)

    const listener = ({ messages }: { messages: any[] }) => {
      for (const msg of messages) {
        if (!msg.key?.fromMe || msg.key?.remoteJid !== jid) continue

        const msgText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          ''

        if (msgText === text) {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            cleanup()
            console.log('[bridge] mensagem confirmada, id=' + msg.key.id)
            resolve(msg.key.id)
          }
          return
        }

        if (!resolved) {
          console.log('[bridge] fromMe ignorada (texto diferente)',
            'esperado=' + JSON.stringify(text),
            'recebido=' + JSON.stringify(msgText),
            'tipos=' + Object.keys(msg.message || {}).join(','))
        }
      }
    }

    const cleanup = () => {
      try { sock?.ev?.off('messages.upsert', listener) } catch {}
    }

    sock!.ev.on('messages.upsert', listener)

    sock!.sendMessage(jid, { text }).then((result) => {
      console.log('[bridge] sendMessage enfileirada, id=' + (result?.key?.id || 'unknown'))
    }).catch((err: Error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        cleanup()
        console.error('[bridge] sendMessage error:', err.message)
        reject(err)
      }
    })
  })

  return messageId
}
