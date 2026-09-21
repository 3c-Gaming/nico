import express from 'express'
import { iniciar, parar, status } from './realtimeListener.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3335', 10)

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.get('/status', (_req, res) => {
  res.json(status)
})

process.on('SIGTERM', async () => {
  console.log('[blacksender-bridge] SIGTERM recebido, encerrando')
  await parar()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[blacksender-bridge] SIGINT recebido, encerrando')
  await parar()
  process.exit(0)
})

iniciar()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`blacksender-bridge rodando na porta ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('[blacksender-bridge] falha ao iniciar:', err.message)
    process.exit(1)
  })
