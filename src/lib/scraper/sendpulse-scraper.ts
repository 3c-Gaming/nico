import type { Browser, Page } from 'puppeteer-core'
import type { ScrapeResultado, ScrapeResultadoNumero, ScrapeChatInfo, StatusInteracaoScrape } from './types'
import { classificarStatus } from './classificador'

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_API_KEY
const SENDPULSE_EMAIL = process.env.SENDPULSE_EMAIL
const SENDPULSE_PASSWORD = process.env.SENDPULSE_PASSWORD

const SESSION_NAME = 'sendpulse-scraper'
const BASE_URL = 'https://login.sendpulse.com'
const CHAT_URL = (botId: string) =>
  `${BASE_URL}/chatbots/chats?bot_id=${botId}&channel=whatsapp&status=all&assignee=all&contact_id=all`

async function conectarBrowser(): Promise<{ browser: Browser; page: Page }> {
  const { default: puppeteer } = await import('puppeteer-core')
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}&track=${SESSION_NAME}`,
    defaultViewport: { width: 1366, height: 768 },
  })
  const pages = await browser.pages()
  const page = pages[0] || (await browser.newPage())
  page.setDefaultTimeout(15000)
  return { browser, page }
}

async function garantirLogin(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' })
  const url = page.url()

  if (!url.includes('login') && !url.includes('auth')) return

  const emailInput = await page.$('input[type="email"]')
  if (!emailInput) throw new Error('Campo de email nao encontrado na pagina de login')

  await emailInput.click()
  await emailInput.type(SENDPULSE_EMAIL || '', { delay: 30 })

  const passwordInput = await page.$('input[type="password"]')
  if (!passwordInput) throw new Error('Campo de senha nao encontrado na pagina de login')

  await passwordInput.click()
  await passwordInput.type(SENDPULSE_PASSWORD || '', { delay: 30 })

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
}

async function extrairChats(page: Page, botId: string): Promise<{
  chats: ScrapeChatInfo[]
  totalChats: number
  botOnline: boolean
}> {
  try {
    await page.goto(CHAT_URL(botId), { waitUntil: 'networkidle2', timeout: 15000 })
  } catch {
    return { chats: [], totalChats: 0, botOnline: false }
  }

  const botOnline = await page.evaluate(() => {
    const errorEl = document.querySelector('.error-page, .server-error, .offline-banner')
    return !errorEl
  })

  if (!botOnline) return { chats: [], totalChats: 0, botOnline: false }

  await page.waitForSelector('.media-dialogs-list', { timeout: 10000 }).catch(() => {})

  const chatItems = await page.$$('.media-chat-item')
  const totalChats = chatItems.length

  const chatsInfo: ScrapeChatInfo[] = []

  for (let i = 0; i < Math.min(chatItems.length, 20); i++) {
    try {
      const info = await page.evaluate((idx: number) => {
        const items = document.querySelectorAll('.media-chat-item')
        const item = items[idx] as HTMLElement
        if (!item) return null

        const nomeEl = item.querySelector('.chat-item-name')
        const dateEl = item.querySelector('.chat-item-date')
        const linkEl = item.querySelector('a.strip-text')

        return {
          contactNome: nomeEl?.textContent?.trim() || 'Desconhecido',
          ultimaAtividade: dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || '',
          contactLink: linkEl?.getAttribute('href') || '',
        }
      }, i)

      if (!info) continue

      chatsInfo.push({
        contactNome: info.contactNome,
        ultimaAtividade: info.ultimaAtividade,
        ultimaMensagemTipo: 'incoming',
        tempoSemRespostaMin: 0,
      })
    } catch {
      continue
    }
  }

  if (chatsInfo.length > 0) {
    try {
      const topLink = await page.evaluate(() => {
        const link = document.querySelector('a.strip-text')
        return link?.getAttribute('href') || ''
      })

      if (topLink) {
        await page.goto(`${BASE_URL}${topLink}`, { waitUntil: 'networkidle2', timeout: 10000 })

        const tipoUltimaMsg = await page.evaluate(() => {
          const msgs = document.querySelectorAll('[class*="chat-message"]')
          const last = msgs[msgs.length - 1]
          if (!last) return 'incoming'
          return last.className.includes('outgoing') ? 'outgoing' : 'incoming'
        })

        const ultimaAtividade = await page.evaluate(() => {
          const dateEl = document.querySelector('.chat-item-date')
          return dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || ''
        })

        chatsInfo[0] = {
          ...chatsInfo[0],
          ultimaMensagemTipo: tipoUltimaMsg,
          ultimaAtividade: ultimaAtividade || chatsInfo[0].ultimaAtividade,
          tempoSemRespostaMin: calcularTempoSemResposta(ultimaAtividade || chatsInfo[0].ultimaAtividade),
        }
      }
    } catch {
      chatsInfo[0] = {
        ...chatsInfo[0],
        tempoSemRespostaMin: calcularTempoSemResposta(chatsInfo[0].ultimaAtividade),
      }
    }
  }

  for (let i = 1; i < chatsInfo.length; i++) {
    chatsInfo[i].tempoSemRespostaMin = calcularTempoSemResposta(chatsInfo[i].ultimaAtividade)
  }

  return { chats: chatsInfo, totalChats, botOnline }
}

function calcularTempoSemResposta(dataStr: string): number {
  if (!dataStr) return 999
  const data = new Date(dataStr)
  if (isNaN(data.getTime())) return 999
  return Math.floor((Date.now() - data.getTime()) / 60000)
}

export async function scrapeNumeros(bots: { id: string; numero: string }[]): Promise<ScrapeResultado> {
  if (!BROWSERLESS_TOKEN) throw new Error('BROWSERLESS_API_KEY nao configurada')
  if (!SENDPULSE_EMAIL || !SENDPULSE_PASSWORD) throw new Error('SENDPULSE_EMAIL/SENDPULSE_PASSWORD nao configurados')

  if (!bots.length) return { timestamp: new Date().toISOString(), numeros: [] }

  const { browser, page } = await conectarBrowser()

  try {
    await garantirLogin(page)

    const resultados: ScrapeResultadoNumero[] = []

    for (const bot of bots) {
      try {
        const dados = await extrairChats(page, bot.id)
        const status = classificarStatus(dados)
        const volume5min = dados.chats.filter((c) => c.tempoSemRespostaMin < 5).length

        resultados.push({
          botId: bot.id,
          status,
          chatsAtivos: dados.totalChats,
          ultimoChat: dados.chats[0],
          volume5min,
        })
      } catch (err) {
        resultados.push({
          botId: bot.id,
          status: 'numero_caido',
          chatsAtivos: 0,
          volume5min: 0,
          erro: (err as Error).message,
        })
      }
    }

    return {
      timestamp: new Date().toISOString(),
      numeros: resultados,
    }
  } finally {
    await page.close().catch(() => {})
  }
}
