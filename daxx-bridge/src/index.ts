import express from 'express'
import { listarCampanhas, getTemplateLink, baixarBaseCSV, invalidateCache, close } from './scraper.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3334', 10)

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.get('/campanhas', async (_req, res) => {
  try {
    const campanhas = await listarCampanhas()
    res.json({ campanhas })
  } catch (err) {
    console.error('[daxx] /campanhas error:', (err as Error).message)
    res.status(502).json({ error: (err as Error).message })
  }
})

app.get('/campanhas/:id/template', async (req, res) => {
  try {
    const { id } = req.params
    const link = await getTemplateLink(id)
    res.json({ link })
  } catch (err) {
    console.error('[daxx] /campanhas/template error:', (err as Error).message)
    res.status(502).json({ error: (err as Error).message })
  }
})

app.get('/campanhas/:id/base', async (req, res) => {
  try {
    const { id } = req.params
    const csv = await baixarBaseCSV(id)
    res.type('text/csv').send(csv)
  } catch (err) {
    console.error('[daxx] /campanhas/base error:', (err as Error).message)
    res.status(502).json({ error: (err as Error).message })
  }
})

app.all('/campanhas/refresh', async (_req, res) => {
  try {
    invalidateCache()
    const campanhas = await listarCampanhas()
    res.json({ campanhas })
  } catch (err) {
    console.error('[daxx] /campanhas/refresh error:', (err as Error).message)
    res.status(502).json({ error: (err as Error).message })
  }
})

process.on('SIGTERM', async () => {
  console.log('[daxx] SIGTERM received, closing browser')
  await close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[daxx] SIGINT received, closing browser')
  await close()
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`daxx-bridge running on port ${PORT}`)
})
