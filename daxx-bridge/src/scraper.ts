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

const cacheCampanhas = new Map<string, { data: DaxxCampaign[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

let loginPromise: Promise<Page> | null = null

// Garante que só uma operação de scraping (filtro de data + leitura de tabela)
// rode por vez na página compartilhada do Playwright. Sem isso, chamadas
// concorrentes (ex: dashboard sem filtro de data rodando junto com uma
// consulta filtrada) pisam uma na filtragem da outra e corrompem o resultado.
let scrapeQueue: Promise<void> = Promise.resolve()

function withScrapeLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = scrapeQueue.then(fn, fn)
  scrapeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function getBrowser(): Promise<Browser> {
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

async function getTableSnapshot(p: Page): Promise<string> {
  return p.evaluate(() => {
    const rows = document.querySelectorAll('#cliDisparosTbody tr')
    const first = rows[0]?.textContent?.trim().slice(0, 80) ?? ''
    return `${rows.length}|${first}`
  })
}

// #cliDisparosTbody sempre tem <tr> presentes antes de um refresh/paginação
// (as linhas antigas continuam no DOM até o AJAX trocar o conteúdo), então
// esperar apenas "existe uma <tr>" resolve na hora e lê dado velho. Comparar
// com um snapshot anterior e esperar "mudou uma vez" também não basta: o
// site passa por um estado intermediário (parece re-renderizar uma prévia)
// antes de assentar no resultado final do filtro. Por isso esperamos a
// tabela mudar E DEPOIS ficar estável (sem mais mudanças) por um tempo.
async function waitForTableChange(
  p: Page,
  previousSnapshot: string,
  timeout = 15000,
  stableChecks = 3,
  interval = 500,
): Promise<void> {
  const deadline = Date.now() + timeout

  try {
    await p.waitForFunction(
      (prev) => {
        const rows = document.querySelectorAll('#cliDisparosTbody tr')
        const first = rows[0]?.textContent?.trim().slice(0, 80) ?? ''
        return `${rows.length}|${first}` !== prev
      },
      previousSnapshot,
      { timeout: Math.max(1000, deadline - Date.now()) },
    )
  } catch {
    console.warn('[daxx] tabela nao mudou dentro do timeout — seguindo com o conteudo atual')
    return
  }

  let consecutive = 0
  let last = await getTableSnapshot(p)
  while (Date.now() < deadline) {
    await p.waitForTimeout(interval)
    const current = await getTableSnapshot(p)
    if (current === last) {
      consecutive++
      if (consecutive >= stableChecks) return
    } else {
      consecutive = 0
      last = current
    }
  }
  console.warn('[daxx] tabela nao estabilizou dentro do timeout — seguindo com o conteudo atual')
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
  const before = await getTableSnapshot(p)
  await p.evaluate(() => {
    const btn = document.getElementById('cliPagProximo') as HTMLButtonElement | null
    btn?.click()
  })
  await waitForTableChange(p, before, 10000)
}

async function setDateFilter(p: Page, startDate?: string, endDate?: string): Promise<void> {
  let fmtInicio: string
  let fmtFim: string

  if (startDate) {
    fmtInicio = startDate
    fmtFim = endDate ?? startDate
  } else {
    const hoje = new Date()
    const inicio = new Date(hoje.getFullYear(), 5, 1)
    fmtInicio = inicio.toISOString().slice(0, 10)
    fmtFim = hoje.toISOString().slice(0, 10)
  }
  console.log('[daxx] applying date filter:', fmtInicio, '->', fmtFim)

  const before = await getTableSnapshot(p)

  // Os campos #cliInicio/#cliFim são <input type="date"> nativos com
  // onchange="loadClienteDisparos()". Setar os dois valores e disparar
  // 'change' em cada um (e depois ainda clicar no botão ↻) faz a função
  // ser chamada VÁRIAS vezes em sequência — uma com cliFim ainda com o
  // valor antigo (troca de cliInicio dispara antes de cliFim ser setado),
  // outra com os valores finais, e mais uma pelo clique do botão. Essas
  // chamadas AJAX concorrentes podem responder fora de ordem e a errada
  // (com data antiga) acaba sendo a última a preencher a tabela.
  // Corrigido chamando a função de carregamento uma única vez, direto,
  // já com os dois valores certos — sem eventos, sem clique redundante.
  await p.evaluate(({ i, f }) => {
    const elInicio = document.getElementById('cliInicio') as HTMLInputElement | null
    const elFim = document.getElementById('cliFim') as HTMLInputElement | null
    if (elInicio) elInicio.value = i
    if (elFim) elFim.value = f
    const loader = (window as unknown as { loadClienteDisparos?: () => void }).loadClienteDisparos
    if (typeof loader === 'function') loader()
  }, { i: fmtInicio, f: fmtFim })

  await waitForTableChange(p, before, 15000, 2, 300)
}

export async function listarCampanhas(startDate?: string, endDate?: string): Promise<DaxxCampaign[]> {
  const cacheKey = startDate ? `${startDate}|${endDate ?? startDate}` : 'default'

  const cached = cacheCampanhas.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[daxx] returning cached campanhas for', cacheKey)
    return cached.data
  }

  return withScrapeLock(async () => {
    // outra chamada concorrente pode ter preenchido o cache enquanto esperávamos a vez
    const cachedAfterLock = cacheCampanhas.get(cacheKey)
    if (cachedAfterLock && Date.now() - cachedAfterLock.timestamp < CACHE_TTL) {
      console.log('[daxx] returning cached campanhas (pós-lock) for', cacheKey)
      return cachedAfterLock.data
    }

    const p = await ensureLoggedIn()
    await setDateFilter(p, startDate, endDate)

    const todas: DaxxCampaign[] = []
    let pagina = 0
    const MAX_PAGINAS = 100
    // Sem startDate (usado pelo dashboard de campanhas, que não filtra por
    // data) a janela é de 2 meses e já passou de 380 campanhas — raspar
    // tudo isso a cada cache-miss é lento e pesado o suficiente pra ter
    // derrubado o processo (SIGTERM) num deploy recente. Consultas com
    // startDate explícito (usadas pelos endpoints públicos) continuam sem
    // limite, já que ali o resultado de um único dia é sempre pequeno.
    const LIMITE_SEM_FILTRO = 100

    while (pagina < MAX_PAGINAS) {
      const campanhas = await lerTabela(p)
      todas.push(...campanhas)
      console.log(`[daxx] pagina ${pagina + 1}: ${campanhas.length} campanhas (total: ${todas.length})`)

      if (!startDate && todas.length >= LIMITE_SEM_FILTRO) {
        console.log(`[daxx] sem filtro de data — mantendo as ${LIMITE_SEM_FILTRO} mais recentes`)
        todas.splice(LIMITE_SEM_FILTRO)
        break
      }

      if (!(await temProximaPagina(p))) break
      await clicarProxima(p)
      pagina++
    }

    console.log(`[daxx] total: ${todas.length} campanhas`)

    cacheCampanhas.set(cacheKey, { data: todas, timestamp: Date.now() })
    return todas
  })
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

export async function baixarBaseCSV(id: string): Promise<string> {
  const p = await ensureLoggedIn()

  const botao = p.locator(`button[onclick*="exportCSVDisparo('${id}'"]`)
  if (!(await botao.count())) {
    throw new Error('botao de exportar CSV nao encontrado para esse disparo')
  }

  const [download] = await Promise.all([
    p.waitForEvent('download', { timeout: 30000 }),
    botao.first().click(),
  ])

  const caminho = await download.path()
  if (!caminho) throw new Error('Download nao gerou arquivo local')

  return readFileSync(caminho, 'utf-8')
}

export async function invalidateCache() {
  cacheCampanhas.clear()
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
