// One-off: junta os leads que entraram HOJE (fuso Brasília) nas tags de entrada de um
// conjunto de fluxos (mesmo bot) e, opcionalmente, dispara um outro fluxo (o quiz) pra
// cada um via /flows/run — sem passar por campanha em massa, um contact_id por vez.
//
// Uso:
//   node scripts/leads-hoje-para-quiz.mjs                                      -> só lista/conta (dry run), grava scripts/leads-hoje-quiz.json
//   node scripts/leads-hoje-para-quiz.mjs --disparar=<flowId>                  -> dispara o flowId do quiz pra TODOS os contatos
//   node scripts/leads-hoje-para-quiz.mjs --disparar=<flowId> --limite=1       -> dispara só pros N primeiros (teste antes do lote todo)

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const BOT_ID = '6a67c099eac9a448760679fb' // Thiago Asmar — 5511955025799
const CONTA_ENV_PREFIX = 'SENDPULSE_01_' // contaId "01", confirmado via /api/sendpulse/numeros

const FLUXOS = [
  { nome: 'F74.02 ODM GENERICO', flowId: '6a7cd9a599c2ebc9dd0930b2', tagEntrada: 'Lead_F74_02' },
  { nome: 'F73.02 ODD 1K GENERICO', flowId: '6a7cd8117ffa6d636d027077', tagEntrada: 'Lead_F73_02' },
  { nome: 'F71.02 ODD 1K', flowId: '6a7ca02965c8385aad0a373f', tagEntrada: 'Lead_F71_02' },
  { nome: 'F72.02 ODM', flowId: '6a7ca024abfc10ceaf051eec', tagEntrada: 'Lead_F72_02' },
]

const OUT_PATH = resolve(__dirname, 'leads-hoje-quiz.json')
const BASE_URL = 'https://api.sendpulse.com/whatsapp'

function carregarEnvLocal() {
  const path = resolve(REPO_ROOT, '.env.local')
  const conteudo = readFileSync(path, 'utf-8')
  const env = {}
  for (const linha of conteudo.split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

function dataParaBrasilISO(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

async function buscarContatosDaTagHoje(tag, apiKey, hoje) {
  const url = `${BASE_URL}/contacts/getByTag?bot_id=${encodeURIComponent(BOT_ID)}&tag=${encodeURIComponent(tag)}&size=1000`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) throw new Error(`getByTag ${tag} error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const contatos = json.data ?? []
  return contatos.filter((c) => c.created_at && dataParaBrasilISO(c.created_at) === hoje)
}

async function executarFlow(contactId, flowId, apiKey) {
  const res = await fetch(`${BASE_URL}/flows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: BOT_ID, contact_id: contactId, flow_id: flowId }),
  })
  const rawBody = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`flows/run ${contactId} error ${res.status}: ${JSON.stringify(rawBody)}`)
  return rawBody
}

async function main() {
  const env = carregarEnvLocal()
  const apiKey = env[`${CONTA_ENV_PREFIX}API_KEY`]
  if (!apiKey) throw new Error(`${CONTA_ENV_PREFIX}API_KEY não encontrada em .env.local`)

  const argDisparar = process.argv.find((a) => a.startsWith('--disparar='))
  const quizFlowId = argDisparar ? argDisparar.split('=')[1] : null
  const argLimite = process.argv.find((a) => a.startsWith('--limite='))
  const limite = argLimite ? Number(argLimite.split('=')[1]) : null
  const argContato = process.argv.find((a) => a.startsWith('--contato='))
  const contatoUnico = argContato ? argContato.split('=')[1] : null

  // Teste avulso num único contact_id (ex: o próprio número de quem está testando) — não
  // passa pela busca de leads de hoje, dispara só pra esse contato e sai.
  if (contatoUnico) {
    if (!quizFlowId) throw new Error('--contato exige --disparar=<flowId>')
    console.log(`Disparando fluxo ${quizFlowId} só pro contato ${contatoUnico} (teste avulso)...`)
    await executarFlow(contatoUnico, quizFlowId, apiKey)
    console.log('ok')
    return
  }

  const hoje = dataParaBrasilISO(new Date())
  console.log(`Hoje (Brasília): ${hoje}\n`)

  const porContato = new Map() // contactId -> { nome, telefone, fluxos: Set<string> }

  for (const fluxo of FLUXOS) {
    const contatos = await buscarContatosDaTagHoje(fluxo.tagEntrada, apiKey, hoje)
    console.log(`${fluxo.nome} (tag ${fluxo.tagEntrada}): ${contatos.length} lead(s) hoje`)
    for (const c of contatos) {
      const id = String(c.id)
      const existente = porContato.get(id)
      if (existente) {
        existente.fluxos.add(fluxo.nome)
      } else {
        porContato.set(id, {
          contactId: id,
          nome: c.channel_data?.name || c.channel_data?.first_name || '',
          telefone: c.channel_data?.username || '',
          fluxos: new Set([fluxo.nome]),
        })
      }
    }
  }

  const lista = [...porContato.values()].map((c) => ({ ...c, fluxos: [...c.fluxos] }))
  console.log(`\nTotal de contatos únicos (dedupe entre fluxos): ${lista.length}`)

  writeFileSync(OUT_PATH, JSON.stringify(lista, null, 2))
  console.log(`Lista gravada em ${OUT_PATH}\n`)

  if (!quizFlowId) {
    console.log('Dry run — nenhuma mensagem foi enviada. Rode de novo com --disparar=<flowId do quiz> pra disparar de verdade.')
    return
  }

  const alvo = limite ? lista.slice(0, limite) : lista
  console.log(`Disparando fluxo ${quizFlowId} pra ${alvo.length} contato(s)${limite ? ` (teste limitado, de ${lista.length} no total)` : ''}...`)
  let ok = 0
  let falhas = 0
  for (const c of alvo) {
    try {
      await executarFlow(c.contactId, quizFlowId, apiKey)
      ok++
      console.log(`  ok: ${c.nome || c.contactId}`)
    } catch (err) {
      falhas++
      console.error(`  falhou: ${c.nome || c.contactId} — ${err.message}`)
    }
  }
  console.log(`\nConcluído: ${ok} disparado(s), ${falhas} falha(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
