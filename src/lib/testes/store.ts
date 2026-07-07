import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { TestResult, TesteDatabase } from './types'

const DATA_DIR = process.env.TESTES_DATA_DIR || path.resolve(process.cwd(), 'data')
const FILE = path.resolve(DATA_DIR, 'testes.json')

let cache: TesteDatabase | null = null

async function load(): Promise<TesteDatabase> {
  if (cache) return cache
  try {
    const raw = await readFile(FILE, 'utf-8')
    cache = JSON.parse(raw)
    return cache!
  } catch {
    return { testes: [] }
  }
}

async function save(db: TesteDatabase) {
  cache = db
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  await writeFile(FILE, JSON.stringify(db, null, 2))
}

export async function listarTestes(): Promise<TestResult[]> {
  const db = await load()
  return db.testes.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
}

export async function salvarResultado(resultado: TestResult) {
  const db = await load()
  db.testes.push(resultado)
  await save(db)
}

export async function buscarTestePendente(from: string): Promise<TestResult | null> {
  const db = await load()
  const emAberto = db.testes.filter(
    (t) => t.status === 'pending' || t.status === 'aguardando_resposta'
  )
  for (const teste of emAberto) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    try {
      const res = await fetch(appUrl + '/api/sendpulse/numeros')
      const data = await res.json()
      const numeros = data.numeros || []
      const bot = numeros.find((n: { id: string }) => n.id === teste.botId)
      if (bot) {
        const numeroEncontrado = String(bot.numero).replace(/\D/g, '')
        const numeroFrom = from.replace(/\D/g, '')
        if (numeroEncontrado === numeroFrom) return teste
      }
    } catch {
      continue
    }
  }
  return null
}

export async function atualizarTeste(id: string, update: Partial<TestResult>) {
  const db = await load()
  const idx = db.testes.findIndex((t) => t.id === id)
  if (idx !== -1) {
    db.testes[idx] = { ...db.testes[idx], ...update }
    await save(db)
  }
}
