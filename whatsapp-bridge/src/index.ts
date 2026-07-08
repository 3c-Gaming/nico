import express from 'express'
import { start, getStatus, getQr, sendMessage, saveWebhookConfig, resetAuth, onMessage } from './whatsapp.js'
import type { SendRequest, ConfigureWebhookRequest, WebhookPayload } from './types.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3333', 10)

app.use(express.json())

app.get('/status', (_req, res) => {
  res.json(getStatus())
})

app.get('/qr', (_req, res) => {
  const qrData = getQr()
  const status = getStatus()
  if (status.connected) {
    res.send(`<html><body style="background:#0D0F12;color:#E8ECF0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2>✅ Conectado</h2><p style="color:#7A8599">Número: ${status.number}</p></div></body></html>`)
    return
  }
  if (qrData) {
    res.send(`<html><body style="background:#0D0F12;color:#E8ECF0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2>Escanear QR Code</h2><img src="${qrData}" style="width:256px;height:256px;image-rendering:pixelated"/><p style="color:#7A8599">Abra o WhatsApp no celular → Menu → WhatsApp Web</p></div></body></html>`)
    return
  }
  res.send(`<html><head><meta http-equiv="refresh" content="2"></head><body style="background:#0D0F12;color:#E8ECF0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2>⏳ Conectando...</h2><p style="color:#7A8599">Aguardando QR code...</p><p style="color:#7A8599;font-size:11px;margin-top:32px">Se ficar preso aqui, tente <a href="/reset-auth" style="color:#d1a0ff">resetar auth</a></p></div></body></html>`)
})

app.post('/send', async (req, res) => {
  try {
    const { to, text } = req.body as SendRequest
    if (!to || !text) {
      res.status(400).json({ success: false, error: 'to e text sao obrigatorios' })
      return
    }
    const messageId = await sendMessage(to, text)
    res.json({ success: true, messageId })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.post('/configure-webhook', async (req, res) => {
  try {
    const { url, secret } = req.body as ConfigureWebhookRequest
    if (!url) {
      res.status(400).json({ success: false, error: 'url é obrigatoria' })
      return
    }
    await saveWebhookConfig(url, secret || process.env.BRIDGE_SECRET)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.post('/reset-auth', async (_req, res) => {
  try {
    await resetAuth()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

start()

app.listen(PORT, () => {
  console.log(`whatsapp-bridge running on port ${PORT}`)
})
