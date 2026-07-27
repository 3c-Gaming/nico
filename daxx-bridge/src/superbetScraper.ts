import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { BrowserContext, Page } from 'playwright'
import { getBrowser } from './scraper.js'

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
    if (!process.env[key]) process.env[key] = value
  }
}

const SUPERBET_LOGIN_URL = process.env.SUPERBET_URL || 'https://affiliates.superbet.com/login.asp'
const SUPERBET_USER = process.env.SUPERBET_USER || ''
const SUPERBET_PASS = process.env.SUPERBET_PASS || ''
const SUPERBET_SITE = process.env.SUPERBET_SITE || 'pilhado1novo'

let context: BrowserContext | null = null
let page: Page | null = null
let lastLogin = 0
let reportGeradoEm = '' // "startDate|endDate" do ultimo Generate Report rodado nesta sessao
const SESSION_TTL = 30 * 60 * 1000

let loginPromise: Promise<Page> | null = null

export interface AcidReportRow {
  period: string
  acid: string
  registrations: number
  firstDepositCount: number
  cpaCount: number
}

export async function ensureLoggedInSuperbet(): Promise<Page> {
  // serializa chamadas concorrentes ao login
  if (loginPromise) return loginPromise

  loginPromise = (async () => {
    const b = await getBrowser()

    if (page && Date.now() - lastLogin < SESSION_TTL) {
      try {
        await page.evaluate(() => document.title)
        return page
      } catch {
        console.log('[superbet] page lost, reconnecting')
      }
    }

    if (context) {
      try { await context.close() } catch {}
      context = null
    }
    page = null
    reportGeradoEm = ''

    context = await b.newContext()
    page = await context.newPage()
    console.log('[superbet] navigating to login')

    await page.goto(SUPERBET_LOGIN_URL, { waitUntil: 'load', timeout: 30000 })

    console.log('[superbet] SUPERBET_USER:', SUPERBET_USER ? 'set' : 'EMPTY')
    console.log('[superbet] SUPERBET_PASS:', SUPERBET_PASS ? 'set' : 'EMPTY')

    await page.waitForSelector('#username', { state: 'visible', timeout: 10000 })
    await page.locator('#username').click()
    await page.locator('#username').fill(SUPERBET_USER)
    await page.locator('#password').click()
    await page.locator('#password').fill(SUPERBET_PASS)
    await page.waitForTimeout(200)

    await page.locator('#FMlogins button[type="submit"]').click()

    try {
      await page.waitForURL(/\/portal/, { timeout: 20000 })
      console.log('[superbet] login ok, redirected to portal')
    } catch {
      const maybeError = (await page.textContent('body').catch(() => 'unknown')) ?? 'unknown'
      console.error('[superbet] login failed:', maybeError.slice(0, 300))
      throw new Error('Falha no login Superbet — verifique credenciais')
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

/** Preenche o formulario de filtros e gera o relatorio (Date + Site profile + Acid), uma vez por sessao/periodo. */
async function gerarRelatorioSeNecessario(p: Page, startDate: string, endDate: string): Promise<void> {
  const chave = `${startDate}|${endDate}`
  if (reportGeradoEm === chave) return

  // Navegar direto pela URL com hash nao funciona nesse app (o router Angular te joga de
  // volta pro welcome.asp) — precisa clicar de verdade no menu lateral: Reports > ACID Report.
  const linkAcid = p.locator('a[href="#/reports/reporting/acid-report"]')
  if (!(await linkAcid.isVisible().catch(() => false))) {
    await p.getByText('Reports', { exact: true }).first().click()
    await p.waitForTimeout(500)
  }
  await linkAcid.first().click()

  try {
    await p.waitForSelector('#StartDate', { state: 'visible', timeout: 30000 })
  } catch (err) {
    await p.screenshot({ path: resolve(__dirname, '..', 'debug-superbet-report.png'), fullPage: true }).catch(() => {})
    const html = await p.content().catch(() => '')
    try {
      writeFileSync(resolve(__dirname, '..', 'debug-superbet-report.html'), html)
    } catch {}
    console.error('[superbet] URL atual no momento do erro:', p.url())
    throw err
  }

  // Esc no kendo-dateinput reverte pro valor anterior em vez de so fechar o popup —
  // por isso usamos Tab (ou clique fora) pra confirmar o valor digitado.
  const dataInicio = p.locator('#datepicker-1')
  await dataInicio.click()
  await dataInicio.press('Control+A')
  await dataInicio.pressSequentially(startDate, { delay: 30 })
  await p.keyboard.press('Tab')

  const dataFim = p.locator('#datepicker-2')
  await dataFim.click()
  await dataFim.press('Control+A')
  await dataFim.pressSequentially(endDate, { delay: 30 })
  await p.keyboard.press('Tab')

  // Aff sites: kendo-combobox com autocomplete — digita o nome do site e confirma a sugestao
  const siteInput = p.locator('#siteid input[role="combobox"]')
  await siteInput.click()
  await siteInput.fill(SUPERBET_SITE)
  await p.waitForTimeout(800)
  await p.keyboard.press('ArrowDown')
  await p.keyboard.press('Enter')

  // Display By: Date, Site profile, Acid
  await p.locator('#cb-0-date').check({ force: true })
  await p.locator('#cb-3-site').check({ force: true })
  await p.locator('#cb-5-affcustomid').check({ force: true })

  await debugSnapshot(p, 'antes-gerar')

  await p.locator('button.button--accept[type="submit"]').click()

  await p.waitForSelector('.k-grid-content .k-master-row, .k-grid-content .k-grid-norecords', { timeout: 30000 })

  await debugSnapshot(p, 'depois-gerar')

  reportGeradoEm = chave
  console.log('[superbet] relatorio gerado para', chave)
}

async function debugSnapshot(p: Page, nome: string): Promise<void> {
  try {
    await p.screenshot({ path: resolve(__dirname, '..', `debug-${nome}.png`), fullPage: true })
    writeFileSync(resolve(__dirname, '..', `debug-${nome}.html`), await p.content())
  } catch {}
}

function extrairNumero(texto: string): number {
  const limpo = texto.replace(/[^\d.-]/g, '')
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : 0
}

/** Filtra a grid pelo ACID exato e le as linhas resultantes (uma por dia, se o periodo cobrir mais de um dia). */
async function lerLinhasPorAcid(p: Page, acid: string): Promise<AcidReportRow[]> {
  // Digitar caractere por caractere nao funciona aqui: a grid dispara um filtro/reload a
  // cada tecla, o que reseta o campo antes da proxima letra chegar (por isso so "p" ficava).
  // Setamos o valor inteiro de uma vez via o setter nativo (contorna o binding do
  // Angular/Kendo) e disparamos um unico evento 'input'.
  const filtro = p.locator('input[aria-label="ACID Filter"]')
  await filtro.click()
  await filtro.evaluate((el: HTMLInputElement, valor: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, valor)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, acid)
  await p.waitForTimeout(300)
  await filtro.press('Enter')
  await p.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await p.waitForTimeout(1500)

  await debugSnapshot(p, 'depois-filtro-acid')

  return p.evaluate(() => {
    const linhas = Array.from(document.querySelectorAll('.k-grid-content .k-master-row'))
    return linhas.map((tr) => {
      const celulas = Array.from(tr.querySelectorAll('td')).map(
        (td) => td.querySelector('.grid-cell-content')?.textContent?.trim() ?? '',
      )
      return {
        period: celulas[0] ?? '',
        acid: celulas[4] ?? '',
        registrationsRaw: celulas[9] ?? '0',
        firstDepositCountRaw: celulas[14] ?? '0',
        cpaCountRaw: celulas[28] ?? '0',
      }
    })
  }).then((linhas) =>
    linhas.map((l) => ({
      period: l.period,
      acid: l.acid,
      registrations: extrairNumero(l.registrationsRaw),
      firstDepositCount: extrairNumero(l.firstDepositCountRaw),
      cpaCount: extrairNumero(l.cpaCountRaw),
    })),
  )
}

/**
 * Busca os resultados (registros, FTDs, CPAs) de um ACID especifico direto no painel de
 * afiliados da Superbet, cruzando pelo periodo de datas informado.
 *
 * NAO TESTADO contra o painel real ainda — os seletores foram montados a partir do HTML
 * fornecido, mas o formulario usa componentes Kendo/Angular (autocomplete, datepicker)
 * que podem precisar de ajuste fino na primeira tentativa real.
 */
export async function buscarResultadoAcid(acid: string, startDate: string, endDate: string): Promise<AcidReportRow[]> {
  const p = await ensureLoggedInSuperbet()
  await gerarRelatorioSeNecessario(p, startDate, endDate)
  return lerLinhasPorAcid(p, acid)
}

export async function closeSuperbet() {
  loginPromise = null
  reportGeradoEm = ''
  if (context) {
    try { await context.close() } catch {}
    context = null
  }
  page = null
}
