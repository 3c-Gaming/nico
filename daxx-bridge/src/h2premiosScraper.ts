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

const H2PREMIOS_LOGIN_URL = process.env.H2PREMIOS_LOGIN_URL || 'https://admin.h2premios.com.br/login'
const H2PREMIOS_DASHBOARD_URL = process.env.H2PREMIOS_URL || 'https://admin.h2premios.com.br/v3/dashboard'

export type ContaH2Premios = 'kaue' | 'thomas' | 'gustavo'

const CONTAS: Record<ContaH2Premios, { email: string; senha: string }> = {
  kaue: { email: process.env.H2PREMIOS_KAUE_EMAIL || '', senha: process.env.H2PREMIOS_KAUE_SENHA || '' },
  thomas: { email: process.env.H2PREMIOS_THOMAS_EMAIL || '', senha: process.env.H2PREMIOS_THOMAS_SENHA || '' },
  gustavo: { email: process.env.H2PREMIOS_GUSTAVO_EMAIL || '', senha: process.env.H2PREMIOS_GUSTAVO_SENHA || '' },
}

interface SessaoConta {
  context: BrowserContext
  page: Page
  lastLogin: number
}

const sessoes = new Map<ContaH2Premios, SessaoConta>()
const loginPromises = new Map<ContaH2Premios, Promise<Page>>()
const SESSION_TTL = 30 * 60 * 1000

// Fila por conta — o cron sincroniza vários dias em sequência e o botão manual pode disparar ao
// mesmo tempo; sem isso duas chamadas concorrentes pra mesma conta mexeriam na mesma page do
// Playwright ao mesmo tempo (navegação + filtro de data) e corromperiam a leitura uma da outra.
const filas = new Map<ContaH2Premios, Promise<unknown>>()

function comFilaDaConta<T>(conta: ContaH2Premios, fn: () => Promise<T>): Promise<T> {
  const fila = filas.get(conta) ?? Promise.resolve()
  const proxima = fila.then(fn, fn)
  filas.set(conta, proxima.then(() => {}, () => {}))
  return proxima
}

export interface ResultadoH2Premios {
  vendas: number
  faturamento: number
}

// chave "YYYY-MM-DD" -> resultado do dia
export type VendasPorDia = Record<string, ResultadoH2Premios>

async function debugSnapshot(p: Page, nome: string): Promise<void> {
  try {
    await p.screenshot({ path: resolve(__dirname, '..', `debug-h2-${nome}.png`), fullPage: true })
    writeFileSync(resolve(__dirname, '..', `debug-h2-${nome}.html`), await p.content())
  } catch {}
}

/**
 * Login isolado por conta (Kaue/Thomas/Gustavo — cada um só vê "Minhas vendas" da própria
 * conta no painel, por isso precisam de sessões separadas). Seletores do formulário de login
 * NÃO foram confirmados contra o painel real ainda (não dá pra testar sem entrar com a senha
 * de verdade, e isso só pode rodar sem supervisão no servidor) — se falhar na primeira
 * tentativa real, o debug-snapshot (screenshot + HTML) e o texto da página no erro devem
 * bastar pra ajustar. Mesmo padrão de "primeira tentativa pode precisar de ajuste fino" já
 * usado em superbetScraper.ts.
 */
async function ensureLoggedIn(conta: ContaH2Premios): Promise<Page> {
  const existente = loginPromises.get(conta)
  if (existente) return existente

  const promise = (async () => {
    const b = await getBrowser()
    const sessao = sessoes.get(conta)

    if (sessao && Date.now() - sessao.lastLogin < SESSION_TTL) {
      try {
        await sessao.page.evaluate(() => document.title)
        return sessao.page
      } catch {
        console.log(`[h2premios:${conta}] page lost, reconnecting`)
      }
    }

    if (sessao) {
      try { await sessao.context.close() } catch {}
      sessoes.delete(conta)
    }

    const { email, senha } = CONTAS[conta]
    if (!email || !senha) throw new Error(`Credenciais H2Premios não configuradas pra conta "${conta}"`)

    const context = await b.newContext()
    const page = await context.newPage()
    console.log(`[h2premios:${conta}] navigating to login`)

    await page.goto(H2PREMIOS_LOGIN_URL, { waitUntil: 'load', timeout: 30000 })

    await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15000 })
    await page.locator('input[type="email"]').first().fill(email)
    await page.locator('input[type="password"]').first().fill(senha)
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: /entrar|acessar|login/i }).click()

    try {
      await page.waitForURL(/\/v3\/dashboard/, { timeout: 20000 })
      console.log(`[h2premios:${conta}] login ok`)
    } catch {
      await debugSnapshot(page, `login-falhou-${conta}`)
      const texto = (await page.textContent('body').catch(() => 'unknown')) ?? 'unknown'
      throw new Error(`Falha no login H2Premios (${conta}) — verifique credenciais. ${texto.slice(0, 200)}`)
    }

    sessoes.set(conta, { context, page, lastLogin: Date.now() })
    return page
  })()

  loginPromises.set(conta, promise)
  try {
    return await promise
  } finally {
    loginPromises.delete(conta)
  }
}

function extrairNumero(texto: string): number {
  const limpo = texto.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : 0
}

// O filtro de período do Dashboard ("Receita de vendas" por dia) se mostrou não confiável —
// os números batem certo pro "Total da Edição" mas dão zero quando se filtra por uma data
// específica (confirmado ao vivo, reproduzindo manualmente no navegador — não é bug do
// scraper). A fonte confiável é a lista crua de compras (Financeiro > Compras), que não passa
// por esse filtro de edição/período: paginamos ela e agrupamos por dia nós mesmos.
const H2PREMIOS_FINANCEIRO_URL = `${H2PREMIOS_DASHBOARD_URL}/financial`
const MAX_PAGINAS_COMPRAS = 50

interface LinhaCompra {
  data: string
  valor: string
  status: string
}

// page.evaluate recebe uma STRING aqui, não uma função — passar a função direto faz o tsx/esbuild
// injetar um helper `__name(...)` no corpo serializado (usado internamente pra preservar nomes de
// função), e esse helper não existe no escopo do browser onde o Playwright roda o código,
// estourando "ReferenceError: __name is not defined". Confirmado ao vivo contra o painel real.
const LER_LINHAS_COMPRAS_JS = `
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
  return rows.map(function (r) {
    var cells = Array.prototype.slice.call(r.querySelectorAll('td'));
    return {
      data: cells[2] ? cells[2].innerText.trim() : '',
      valor: cells[4] ? cells[4].innerText.trim() : '',
      status: cells[5] ? cells[5].innerText.trim() : '',
    };
  });
})()
`

async function lerLinhasCompras(p: Page): Promise<LinhaCompra[]> {
  return p.evaluate<LinhaCompra[]>(LER_LINHAS_COMPRAS_JS)
}

/** "DD/MM/YYYY às HH:mm" -> Date. Confirmado ao vivo contra o painel real (formato exato da
 * coluna DATA da lista de compras). */
function parseDataHoraBR(texto: string): Date | null {
  const m = texto.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})/)
  if (!m) return null
  const [, dd, mm, yyyy, hh, mi] = m
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function dataParaChave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Avança pra próxima página da tabela de compras — o botão "Próxima" não tem aria-label
 * (só "Primeira página"/"Última página" têm), então acha ele pela posição: penúltimo botão
 * dentro do mesmo container do botão "Última página". Confirmado ao vivo contra o painel real. */
async function irProximaPaginaCompras(p: Page): Promise<boolean> {
  const container = p.locator('button[aria-label="Última página"]').locator('..')
  const botoes = container.locator('button')
  const total = await botoes.count()
  if (total < 2) return false
  const proxima = botoes.nth(total - 2)
  if (await proxima.isDisabled()) return false

  const primeiraLinhaAntes = await p.locator('table tbody tr').first().innerText().catch(() => '')
  await proxima.click()
  await p.waitForFunction(
    (anterior) => {
      const tr = document.querySelector('table tbody tr')
      return !!tr && tr.textContent !== anterior
    },
    primeiraLinhaAntes,
    { timeout: 10000 },
  ).catch(() => {})
  return true
}

async function abrirCompras(p: Page): Promise<void> {
  await p.goto(H2PREMIOS_FINANCEIRO_URL, { waitUntil: 'load', timeout: 30000 })
  await p.getByRole('button', { name: 'Compras', exact: true }).click()
  await p.waitForSelector('table tbody tr', { timeout: 15000 }).catch(() => {})
}

/**
 * Vendas/faturamento por dia (últimos `diasAtras` dias), agrupados a partir da lista crua de
 * compras — não do card "Receita de vendas" do Dashboard, que se mostrou não confiável por data
 * (ver comentário acima). A lista vem ordenada da mais recente pra mais antiga, então paramos de
 * paginar assim que uma página inteira já está fora da janela.
 */
export async function buscarVendasGeraisPorDia(conta: ContaH2Premios, diasAtras = 14): Promise<VendasPorDia> {
  return comFilaDaConta(conta, async () => {
    const p = await ensureLoggedIn(conta)
    try {
      await abrirCompras(p)

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - diasAtras)
      cutoff.setHours(0, 0, 0, 0)

      const porDia: VendasPorDia = {}
      let pagina = 1

      while (pagina <= MAX_PAGINAS_COMPRAS) {
        const linhas = await lerLinhasCompras(p)
        if (linhas.length === 0) break

        let algumaDentroDaJanela = false
        for (const linha of linhas) {
          const data = parseDataHoraBR(linha.data)
          if (!data) continue
          if (data < cutoff) continue
          algumaDentroDaJanela = true
          if (linha.status !== 'Finalizado') continue
          const chave = dataParaChave(data)
          if (!porDia[chave]) porDia[chave] = { vendas: 0, faturamento: 0 }
          porDia[chave].vendas++
          porDia[chave].faturamento += extrairNumero(linha.valor)
        }

        if (!algumaDentroDaJanela) break

        const avancou = await irProximaPaginaCompras(p)
        if (!avancou) break
        pagina++
      }

      for (const chave of Object.keys(porDia)) {
        porDia[chave].faturamento = Math.round((porDia[chave].faturamento + Number.EPSILON) * 100) / 100
      }

      return porDia
    } catch (err) {
      await debugSnapshot(p, `compras-falhou-${conta}`)
      throw err
    }
  })
}

export async function closeH2Premios(): Promise<void> {
  for (const [, sessao] of sessoes) {
    try { await sessao.context.close() } catch {}
  }
  sessoes.clear()
  loginPromises.clear()
}
