import type { ScrapeResultado, ScrapeResultadoNumero, ScrapeChatInfo, StatusInteracaoScrape } from './types'
import { classificarStatus } from './classificador'

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_API_KEY ?? process.env.BROWSERLESS_IO_API_KEY
const SENDPULSE_EMAIL = process.env.SENDPULSE_EMAIL
const SENDPULSE_PASSWORD = process.env.SENDPULSE_PASSWORD
const BROWSERLESS_API_URL = process.env.BROWSERLESS_API_URL || 'https://production-sfo.browserless.io'

function calcularTempoSemResposta(dataStr: string): number {
  if (!dataStr) return 999
  const data = new Date(dataStr)
  if (isNaN(data.getTime())) return 999
  return Math.floor((Date.now() - data.getTime()) / 60000)
}

function buildCode(): string {
  return [
    'export default async ({ page, context }) => {',
    "  const { bots, email, password } = context;",
    "  const BASE = 'https://login.sendpulse.com';",
    "  const chatUrl = id => BASE + '/chatbots/chats?bot_id=' + id + '&channel=whatsapp&status=all&assignee=all&contact_id=all';",
    '',
    "  const results = [];",
    '',
    '  try {',
    "    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 20000 });",
    '    const url = page.url();',
    '',
    "    if (url.includes('login') || url.includes('auth')) {",
    "      await page.waitForSelector('#login', { timeout: 10000 });",
    "      await page.click('#login');",
    "      await page.type('#login', email, { delay: 15 });",
    "      await page.type('#password', password, { delay: 15 });",
    "      await Promise.all([",
    "        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),",
    "        page.click('button[type=\"submit\"]'),",
    '      ]);',
    '    }',
    '  } catch (err) {',
    "    return { data: { erro: 'Login failed: ' + err.message }, type: 'application/json' };",
    '  }',
    '',
    '  for (const bot of bots) {',
    '    try {',
    "      await page.goto(chatUrl(bot.id), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(function(){});",
    '',
    '      const botOnline = await page.evaluate(function() {',
    "        return !document.querySelector('.error-page, .server-error, .offline-banner');",
    '      });',
    '',
    '      if (!botOnline) {',
    "        results.push({ botId: bot.id, chatsTotal: 0, botOnline: false, chats: [] });",
    '        continue;',
    '      }',
    '',
    "      await page.waitForSelector('.media-dialogs-list', { timeout: 10000 }).catch(function(){});",
    '',
    '      const chatsRaw = await page.evaluate(function() {',
    "        const items = document.querySelectorAll('.media-chat-item');",
    '        return Array.from(items).slice(0, 10).map(function(item) {',
    "          var nameEl = item.querySelector('.chat-item-name');",
    "          var dateEl = item.querySelector('.chat-item-date');",
    "          var linkEl = item.querySelector('a.strip-text');",
    '          return {',
    "            cn: nameEl ? nameEl.textContent.trim() : 'Desconhecido',",
    "            ua: dateEl ? (dateEl.getAttribute('title') || dateEl.textContent.trim() || '') : ''",
    '          };',
    '        });',
    '      });',
    '',
    "      results.push({",
    "        botId: bot.id,",
    '        chatsTotal: chatsRaw.length,',
    '        botOnline: true,',
    '        chats: chatsRaw.map(function(c) {',
    "          return { contactNome: c.cn, ultimaAtividade: c.ua, ultimaMensagemTipo: 'incoming' };",
    '        }),',
    '      });',
    '    } catch (err) {',
    "      results.push({ botId: bot.id, chatsTotal: 0, botOnline: false, chats: [], erro: err.message });",
    '    }',
    '  }',
    '',
    '  return { data: results, type: \'application/json\' };',
    '}',
  ].join('\n')
}

interface BrowserlessResultChat {
  contactNome: string
  ultimaAtividade: string
  ultimaMensagemTipo: 'incoming' | 'outgoing'
}

interface BrowserlessResult {
  botId: string
  chatsTotal: number
  botOnline: boolean
  chats: BrowserlessResultChat[]
  erro?: string
}

export async function scrapeNumeros(bots: { id: string; numero: string }[]): Promise<ScrapeResultado> {
  if (!BROWSERLESS_TOKEN) throw new Error('BROWSERLESS_API_KEY nao configurada')
  if (!SENDPULSE_EMAIL || !SENDPULSE_PASSWORD) throw new Error('SENDPULSE_EMAIL/SENDPULSE_PASSWORD nao configurados')
  if (!bots.length) return { timestamp: new Date().toISOString(), numeros: [] }

  const url = BROWSERLESS_API_URL + '/function?token=' + BROWSERLESS_TOKEN

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: buildCode(),
      context: {
        bots: bots.map(function(b) { return { id: b.id } }),
        email: SENDPULSE_EMAIL,
        password: SENDPULSE_PASSWORD,
      },
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) throw new Error('Browserless API error: ' + response.status)

  const body = await response.json()
  const rawData = body.data

  if (!Array.isArray(rawData)) {
    throw new Error(rawData?.erro || 'Browserless retornou formato inesperado')
  }

  const rawResults = rawData as BrowserlessResult[]
  const numeros: ScrapeResultadoNumero[] = (rawResults || []).map(function(r) {
    const chats: ScrapeChatInfo[] = (r.chats || []).map(function(c) {
      return {
        contactNome: c.contactNome,
        ultimaAtividade: c.ultimaAtividade,
        ultimaMensagemTipo: c.ultimaMensagemTipo,
        tempoSemRespostaMin: calcularTempoSemResposta(c.ultimaAtividade),
      }
    })

    const dadosClassificador = {
      chats: chats,
      totalChats: r.chatsTotal || 0,
      botOnline: r.botOnline ?? false,
    }

    const status = classificarStatus(dadosClassificador)
    const volume5min = chats.filter(function(c) { return c.tempoSemRespostaMin < 5 }).length

    return {
      botId: r.botId,
      status: status,
      chatsAtivos: r.chatsTotal || 0,
      ultimoChat: chats[0],
      volume5min: volume5min,
    }
  })

  return { timestamp: new Date().toISOString(), numeros: numeros }
}
