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

export interface EdicaoH2Premios {
  id: string
  label: string
}

export interface ResultadoEdicaoH2Premios {
  edicaoId: string
  edicaoLabel: string
  receitaVendas: number
  ticketMedio: number
  quantidadeCompras: number
  clientesCaptados: number
}

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

// O filtro de período do Dashboard (Hoje/7 dias/30 dias/Este mês, e os botões do gráfico) não
// funciona de verdade — confirmado ao vivo: clicar neles muda a URL da chamada de API por trás,
// mas os cards e o gráfico na tela continuam mostrando os mesmos números de antes. A única coisa
// que realmente refiltra os cards "Minhas vendas" é trocar a Edição no seletor do topo — cada
// edição é um sorteio (ex: "#2 - CONCORRA A UMA BMW...") com Receita de vendas/Ticket
// médio/Quantidade de compras acumulados da edição inteira, não por dia. Não dá pra saber sozinho
// qual edição está "ativa" (a mais nova pode estar zerada, uma edição nova sem vendas ainda) —
// por isso a edição é escolhida manualmente pelo usuário no app, não detectada aqui.
const H2PREMIOS_DASHBOARD_PATH = H2PREMIOS_DASHBOARD_URL

async function abrirDashboard(p: Page): Promise<void> {
  await p.goto(H2PREMIOS_DASHBOARD_PATH, { waitUntil: 'load', timeout: 30000 })
  await p.waitForSelector('select', { timeout: 15000 })
}

// page.evaluate recebe uma STRING aqui, não uma função — passar a função direto faz o tsx/esbuild
// injetar um helper `__name(...)` no corpo serializado (usado internamente pra preservar nomes de
// função), e esse helper não existe no escopo do browser onde o Playwright roda o código,
// estourando "ReferenceError: __name is not defined". Confirmado ao vivo contra o painel real.
const LISTAR_EDICOES_JS = `
(function () {
  var select = document.querySelector('select');
  if (!select) return [];
  return Array.prototype.slice.call(select.options).map(function (o) {
    return { id: o.value, label: o.textContent.trim() };
  });
})()
`

/** Lista as edições disponíveis no seletor do Dashboard (id + label), pra o usuário escolher qual
 * está ativa na configuração do app. Confirmado ao vivo: é um <select> nativo único na página. */
export async function listarEdicoes(conta: ContaH2Premios): Promise<EdicaoH2Premios[]> {
  return comFilaDaConta(conta, async () => {
    const p = await ensureLoggedIn(conta)
    await abrirDashboard(p)
    return p.evaluate<EdicaoH2Premios[]>(LISTAR_EDICOES_JS)
  })
}

// Acha o card pelo texto do label (ex: "Receita de vendas") e lê o <p> com o valor dentro do
// mesmo container — confirmado ao vivo contra o painel real (label e valor vivem na mesma div,
// então pegar o <p> mais próximo do menor container que começa com o texto do label funciona
// mesmo sem depender de classes CSS, que não têm nome semântico nesse app).
const VALOR_DO_CARD_FN = `
  function valorDoCard(labelText) {
    var divs = Array.prototype.slice.call(document.querySelectorAll('div'));
    var candidatos = divs.filter(function (d) {
      return d.textContent.trim().indexOf(labelText) === 0 && d.querySelector('p');
    });
    candidatos.sort(function (a, b) { return a.textContent.length - b.textContent.length; });
    var container = candidatos[0];
    var p = container ? container.querySelector('p') : null;
    return p ? p.textContent.trim() : null;
  }
`

const LER_CARDS_MINHAS_VENDAS_JS = `
(function () {
  ${VALOR_DO_CARD_FN}
  return {
    receitaVendas: valorDoCard('Receita de vendas'),
    ticketMedio: valorDoCard('Ticket médio'),
    quantidadeCompras: valorDoCard('Quantidade de compras'),
    clientesCaptados: valorDoCard('Clientes captados'),
  };
})()
`

interface CardsMinhasVendas {
  receitaVendas: string | null
  ticketMedio: string | null
  quantidadeCompras: string | null
  clientesCaptados: string | null
}

function esperarReceitaMudarJs(anteriorJson: string): string {
  return `
(function () {
  ${VALOR_DO_CARD_FN}
  return valorDoCard('Receita de vendas') !== ${anteriorJson};
})()
`
}

/**
 * Lê os cards "Minhas vendas" (Receita de vendas, Ticket médio, Quantidade de compras, Clientes
 * captados) do Dashboard pra uma Edição específica. `edicaoId` vem da configuração salva pelo
 * usuário (ver listarEdicoes) — não tentamos adivinhar qual edição está ativa.
 */
export async function buscarResultadoEdicao(conta: ContaH2Premios, edicaoId: string): Promise<ResultadoEdicaoH2Premios> {
  return comFilaDaConta(conta, async () => {
    const p = await ensureLoggedIn(conta)
    try {
      await abrirDashboard(p)

      const antes = await p.evaluate<CardsMinhasVendas>(LER_CARDS_MINHAS_VENDAS_JS)
      await p.selectOption('select', edicaoId)
      // espera o card mudar de valor antes de ler — evita pegar um valor stale da edição anterior
      // enquanto a nova ainda está carregando. Se o valor já for igual (mesma edição selecionada
      // de novo), o timeout é só um custo fixo, não um erro. 20s porque a primeira troca depois de
      // um login novo pode demorar mais que o normal pra buscar os dados (visto ao vivo: 8s não
      // bastava e a leitura ficava presa no valor zerado de antes de trocar).
      await p.waitForFunction(esperarReceitaMudarJs(JSON.stringify(antes.receitaVendas)), null, { timeout: 20000 }).catch(() => {})

      const selecionada = await p.evaluate<{ label: string } | null>(`
        (function () {
          var select = document.querySelector('select');
          if (!select) return null;
          var opt = select.options[select.selectedIndex];
          return opt ? { label: opt.textContent.trim() } : null;
        })()
      `)

      // Às vezes a troca de edição passa por um instante em que os cards somem da tela (skeleton
      // de loading) — se a leitura cair bem nesse instante, vem tudo null. Tenta de novo mais
      // algumas vezes antes de desistir, em vez de devolver zero errado.
      let cards: CardsMinhasVendas = { receitaVendas: null, ticketMedio: null, quantidadeCompras: null, clientesCaptados: null }
      for (let tentativa = 1; tentativa <= 4; tentativa++) {
        await p.waitForTimeout(1500)
        cards = await p.evaluate<CardsMinhasVendas>(LER_CARDS_MINHAS_VENDAS_JS)
        if (cards.receitaVendas != null) break
      }

      return {
        edicaoId,
        edicaoLabel: selecionada?.label ?? '',
        receitaVendas: extrairNumero(cards.receitaVendas ?? ''),
        ticketMedio: extrairNumero(cards.ticketMedio ?? ''),
        quantidadeCompras: Math.round(extrairNumero(cards.quantidadeCompras ?? '')),
        clientesCaptados: Math.round(extrairNumero(cards.clientesCaptados ?? '')),
      }
    } catch (err) {
      await debugSnapshot(p, `edicao-falhou-${conta}`)
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
