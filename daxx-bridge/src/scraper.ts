import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import type { DaxxCampaign } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const DAXX_URL = process.env.DAXX_URL || 'https://disparosimples.tech/'
const DAXX_USER = process.env.DAXX_USER || ''
const DAXX_PASS = process.env.DAXX_PASS || ''

let browser: Browser | null = null
let context: BrowserContext | null = null
let page: Page | null = null
let lastLogin = 0
const SESSION_TTL = 30 * 60 * 1000

let cacheCampanhas: { data: DaxxCampaign[]; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

let loginPromise: Promise<Page> | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    console.log('[daxx] browser launched')
  }
  return browser
}

export async function ensureLoggedIn(): Promise<Page> {
  // serializa chamadas concorrentes ao login
  if (loginPromise) return loginPromise

  loginPromise = (async () => {
    const b = await getBrowser()

    if (page && Date.now() - lastLogin < SESSION_TTL) {
      try {
        await page.evaluate(() => document.title)
        return page
      } catch {
        console.log('[daxx] page lost, reconnecting')
      }
    }

    if (context) {
      try { await context.close() } catch {}
      context = null
    }
    page = null

    context = await b.newContext()
    page = await context.newPage()
    console.log('[daxx] navigating to login')

    await page.goto(DAXX_URL, {
      waitUntil: 'load',
      timeout: 30000,
    })

    console.log('[daxx] DAXX_USER:', DAXX_USER ? 'set' : 'EMPTY')
    console.log('[daxx] DAXX_PASS:', DAXX_PASS ? 'set' : 'EMPTY')

    await page.waitForSelector('#loginUser', { state: 'visible', timeout: 10000 })
    await page.waitForTimeout(1000)

    await page.locator('#loginUser').pressSequentially(DAXX_USER, { delay: 30 })
    await page.locator('#loginPass').pressSequentially(DAXX_PASS, { delay: 30 })
    await page.waitForTimeout(200)

    await page.locator('.login-btn').click()

    try {
      await page.waitForSelector('#cliDisparosTbody', { timeout: 15000 })
      console.log('[daxx] login ok, table loaded')
    } catch {
      const maybeError = (await page.textContent('body').catch(() => 'unknown')) ?? 'unknown'
      console.error('[daxx] login failed:', maybeError.slice(0, 300))
      throw new Error('Falha no login DAXX — verifique credenciais')
    }

    lastLogin = Date.now()
    return page
  })()

  try {
    return await loginPromise
  } finally {
    loginPromise = null
  }
}

async function lerTabela(p: Page): Promise<DaxxCampaign[]> {
  return await p.evaluate(() => {
    const rows = document.querySelectorAll('#cliDisparosTbody tr')
    const results: DaxxCampaign[] = []

    for (const row of rows) {
      const tds = row.querySelectorAll('td')
      if (tds.length < 9) continue

      const dataCriacao = tds[0]?.textContent?.trim() || ''
      const nome = (tds[1] as HTMLElement)?.title || tds[1]?.textContent?.trim() || ''
      const responsavel = tds[2]?.textContent?.trim() || ''
      const statusEl = tds[3]?.querySelector('.rel-badge')
      const status = statusEl?.textContent?.trim() || ''
      const totalBase = parseInt(tds[4]?.textContent?.replace(/[^0-9]/g, '') || '0', 10)
      const entregues = parseInt(((tds[5]?.textContent ?? '').trim().split(/\s/)[0] || '0').replace(/[^0-9]/g, ''), 10) || 0
      const lidas = parseInt(((tds[6]?.textContent ?? '').trim().split(/\s/)[0] || '0').replace(/[^0-9]/g, ''), 10) || 0
      const rejeitados = parseInt(tds[7]?.textContent?.replace(/[^0-9]/g, '') || '0', 10)

      const acoes = tds[8]
      let id = ''
      const eyeBtn = acoes?.querySelector('button[onclick*="verCopyDisparo"]') as HTMLElement
      if (eyeBtn?.getAttribute) {
        const match = eyeBtn.getAttribute('onclick')?.match(/'(.*?)'/)
        if (match) id = match[1]
      }
      if (!id) id = `fallback_${nome}_${dataCriacao}`.replace(/\s+/g, '_')

      results.push({
        id,
        nome,
        status,
        responsavel,
        totalBase,
        entregues,
        lidas,
        rejeitados,
        dataCriacao,
      })
    }

    return results
  })
}

async function temProximaPagina(p: Page): Promise<boolean> {
  return p.evaluate(() => {
    const btn = document.getElementById('cliPagProximo') as HTMLButtonElement | null
    return btn !== null && !btn.disabled
  })
}

async function clicarProxima(p: Page): Promise<void> {
  await p.evaluate(() => {
    const btn = document.getElementById('cliPagProximo') as HTMLButtonElement | null
    btn?.click()
  })
  await p.waitForSelector('#cliDisparosTbody tr', { timeout: 10000 })
}

async function setDateFilter(p: Page): Promise<void> {
  const hoje = new Date()
  const inicio = new Date(hoje.getFullYear(), 5, 1)
  const fmtInicio = inicio.toISOString().slice(0, 10)
  const fmtFim = hoje.toISOString().slice(0, 10)
  console.log('[daxx] applying date filter:', fmtInicio, '->', fmtFim)

  await p.evaluate(({ i, f }) => {
    const elInicio = document.getElementById('cliInicio') as HTMLInputElement | null
    const elFim = document.getElementById('cliFim') as HTMLInputElement | null
    if (elInicio) elInicio.value = i
    if (elFim) elFim.value = f
  }, { i: fmtInicio, f: fmtFim })

  await p.evaluate(() => {
    const btns = document.querySelectorAll<HTMLButtonElement>('.btn')
    for (const btn of btns) {
      if (btn.textContent?.includes('↻')) { btn.click(); break }
    }
  })

  await p.waitForSelector('#cliDisparosTbody tr', { timeout: 15000 })
}

export async function listarCampanhas(): Promise<DaxxCampaign[]> {
  if (cacheCampanhas && Date.now() - cacheCampanhas.timestamp < CACHE_TTL) {
    console.log('[daxx] returning cached campanhas')
    return cacheCampanhas.data
  }

  const p = await ensureLoggedIn()
  await setDateFilter(p)

  const todas: DaxxCampaign[] = []
  let pagina = 0
  const MAX_PAGINAS = 100

  while (pagina < MAX_PAGINAS) {
    const campanhas = await lerTabela(p)
    todas.push(...campanhas)
    console.log(`[daxx] pagina ${pagina + 1}: ${campanhas.length} campanhas (total: ${todas.length})`)

    if (todas.length >= 50) {
      todas.splice(50)
      console.log('[daxx] limit reached, keeping 50 most recent')
      break
    }

    if (!(await temProximaPagina(p))) break
    await clicarProxima(p)
    pagina++
  }

  console.log(`[daxx] total: ${todas.length} campanhas`)

  cacheCampanhas = { data: todas, timestamp: Date.now() }
  return todas
}

export async function getTemplateLink(id: string): Promise<string> {
  const p = await ensureLoggedIn()

  const fnExists = await p.evaluate(() => typeof (window as any).verCopyDisparo === 'function')
  if (!fnExists) throw new Error('funcao verCopyDisparo nao encontrada no escopo global')

  await p.evaluate((campaignId) => {
    (window as any).verCopyDisparo(campaignId)
  }, id)

  await p.waitForSelector('#modalCopyDisparo', { timeout: 10000 })
  await p.waitForTimeout(500)

  const link = await p.locator('#modalCopyDisparo a[href]').first().getAttribute('href')
  if (!link) throw new Error('Link nao encontrado no modal')

  const closeBtn = p.locator('#modalCopyDisparo [onclick*="fechar"], #modalCopyDisparo .close, #modalCopyDisparo button').first()
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click().catch(() => {})
  }

  return link
}

export async function invalidateCache() {
  cacheCampanhas = null
}

export async function close() {
  loginPromise = null
  if (context) {
    try { await context.close() } catch {}
    context = null
  }
  page = null
  if (browser) {
    try { await browser.close() } catch {}
    browser = null
  }
  console.log('[daxx] browser closed')
}
