import express from 'express'
import { listarCampanhas, getTemplateLink, baixarBaseCSV, invalidateCache, close } from './scraper.js'
import { buscarResultadoAcid, closeSuperbet } from './superbetScraper.js'
import { buscarVendasGeraisPorDia, closeH2Premios, type ContaH2Premios } from './h2premiosScraper.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3334', 10)

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.get('/campanhas', async (req, res) => {
  try {
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined
    const campanhas = await listarCampanhas(startDate, endDate)
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

app.all('/campanhas/refresh', async (req, res) => {
  try {
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined
    invalidateCache()
    const campanhas = await listarCampanhas(startDate, endDate)
    res.json({ campanhas })
  } catch (err) {
    console.error('[daxx] /campanhas/refresh error:', (err as Error).message)
    res.status(502).json({ error: (err as Error).message })
  }
})

app.get('/superbet/acid', async (req, res) => {
  try {
    const acid = String(req.query.acid ?? '')
    const startDate = String(req.query.startDate ?? '')
    const endDate = String(req.query.endDate ?? startDate)
    if (!acid || !startDate) {
      res.status(400).json({ error: 'Parametros obrigatorios: acid, startDate (endDate opcional)' })
      return
    }
    const linhas = await buscarResultadoAcid(acid, startDate, endDate)
    const totais = linhas.reduce(
      (acc, l) => ({
        registrations: acc.registrations + l.registrations,
        firstDepositCount: acc.firstDepositCount + l.firstDepositCount,
        cpaCount: acc.cpaCount + l.cpaCount,
      }),
      { registrations: 0, firstDepositCount: 0, cpaCount: 0 },
    )
    res.json({ acid, startDate, endDate, ...totais, linhas })
  } catch (err) {
    console.error('[superbet] /superbet/acid error:', (err as Error).message)
    res.status(502).json({ error: (err as Error).message })
  }
})

const CONTAS_H2 = new Set(['kaue', 'thomas', 'gustavo'])

app.get('/h2premios/vendas-por-dia', async (req, res) => {
  try {
    const conta = String(req.query.conta ?? '')
    const desde = String(req.query.desde ?? '')
    if (!CONTAS_H2.has(conta)) {
      res.status(400).json({ error: 'Parametro "conta" deve ser kaue, thomas ou gustavo' })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
      res.status(400).json({ error: 'Parametro "desde" deve ser uma data YYYY-MM-DD' })
      return
    }
    const porDia = await buscarVendasGeraisPorDia(conta as ContaH2Premios, desde)
    res.json({ conta, porDia })
  } catch (err) {
    console.error('[h2premios] /h2premios/vendas-por-dia error:', (err as Error).message)
    res.status(502).json({ error: (err as Error).message })
  }
})

process.on('SIGTERM', async () => {
  console.log('[daxx] SIGTERM received, closing browser')
  await closeSuperbet()
  await closeH2Premios()
  await close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[daxx] SIGINT received, closing browser')
  await closeSuperbet()
  await closeH2Premios()
  await close()
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`daxx-bridge running on port ${PORT}`)
})
