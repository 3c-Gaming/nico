// Script one-off: le DISP_JUNHO_RESULTADO_OK.csv da raiz do repo, classifica cada
// disparo por ciclo (D1/D3/D5/D7/TOTAL) e casa, agrega tudo e escreve
// src/data/resultadosJunho2026.ts com os dados prontos pra pagina /resultados-junho-26.
//
// Uso: node scripts/gerar-resultados-junho-2026.mjs

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const CSV_PATH = resolve(REPO_ROOT, 'DISP_JUNHO_RESULTADO_OK.csv')
const OUT_PATH = resolve(REPO_ROOT, 'src', 'data', 'resultadosJunho2026.ts')

function parseCsvLine(line) {
  const campos = []
  let atual = ''
  let dentroAspas = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (dentroAspas) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          atual += '"'
          i++
        } else {
          dentroAspas = false
        }
      } else {
        atual += ch
      }
    } else if (ch === '"') {
      dentroAspas = true
    } else if (ch === ',') {
      campos.push(atual)
      atual = ''
    } else {
      atual += ch
    }
  }
  campos.push(atual)
  return campos
}

// "R$ 4.710,50" / "57,87%" / "1.234,00" -> 4710.5 / 57.87 / 1234
function numeroBR(s) {
  if (!s) return 0
  const limpo = s.replace(/R\$\s?/, '').replace('%', '').trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : 0
}

function classificarCiclo(nome) {
  const m = nome.match(/\bD([1357])\b/)
  return m ? `D${m[1]}` : 'TOTAL'
}

function agregadoVazio() {
  return { disparos: 0, entregues: 0, lidas: 0, custo: 0, faturamento: 0, lucro: 0, registros: 0, ftd: 0, cpas: 0, roas: 0 }
}

function acumular(agg, d) {
  agg.disparos++
  agg.entregues += d.entregues
  agg.lidas += d.lidas
  agg.custo += d.custo
  agg.faturamento += d.cpaReceita
  agg.lucro += d.lucro
  agg.registros += d.registros
  agg.ftd += d.ftd
  agg.cpas += d.cpas
}

function fecharRoas(agg) {
  agg.roas = agg.custo > 0 ? agg.faturamento / agg.custo : 0
  return agg
}

function round2(n) {
  return Math.round(n * 100) / 100
}

const raw = readFileSync(CSV_PATH, 'utf-8')
const linhas = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
const corpo = linhas.slice(1, -1) // remove header e linha TOTAIS

const disparos = corpo.map((linha) => {
  const c = parseCsvLine(linha)
  const nome = (c[3] ?? '').trim()
  return {
    data: (c[0] ?? '').trim(),
    casa: (c[1] ?? '').trim(),
    utm: (c[2] ?? '').trim(),
    nome,
    ciclo: classificarCiclo(nome),
    lucro: round2(numeroBR(c[4])),
    roas: numeroBR(c[5]),
    entregues: numeroBR(c[6]),
    lidas: numeroBR(c[7]),
    cliques: numeroBR(c[8]),
    custo: round2(numeroBR(c[11])),
    registros: numeroBR(c[16]),
    ftd: numeroBR(c[17]),
    cpas: numeroBR(c[18]),
    cpaReceita: round2(numeroBR(c[19])),
  }
})

// --- totais ---
const totais = agregadoVazio()
for (const d of disparos) acumular(totais, d)
fecharRoas(totais)

// --- por ciclo ---
const porCiclo = { D1: agregadoVazio(), D3: agregadoVazio(), D5: agregadoVazio(), D7: agregadoVazio(), TOTAL: agregadoVazio() }
for (const d of disparos) acumular(porCiclo[d.ciclo], d)
for (const k of Object.keys(porCiclo)) fecharRoas(porCiclo[k])

// --- por casa ---
const porCasa = {}
for (const d of disparos) {
  if (!porCasa[d.casa]) porCasa[d.casa] = agregadoVazio()
  acumular(porCasa[d.casa], d)
}
for (const k of Object.keys(porCasa)) fecharRoas(porCasa[k])

// --- por dia ---
const porDiaMap = new Map()
for (const d of disparos) {
  if (!porDiaMap.has(d.data)) porDiaMap.set(d.data, { data: d.data, lucro: 0, entregues: 0, ftd: 0 })
  const dia = porDiaMap.get(d.data)
  dia.lucro += d.lucro
  dia.entregues += d.entregues
  dia.ftd += d.ftd
}
const porDia = [...porDiaMap.values()]
  .map((d) => ({ ...d, lucro: round2(d.lucro) }))
  .sort((a, b) => {
    const [da, ma] = a.data.split('/').map(Number)
    const [db, mb] = b.data.split('/').map(Number)
    return ma - mb || da - db
  })

const melhorDia = porDia.reduce((m, d) => (d.lucro > m.lucro ? d : m), porDia[0])

const porLucro = [...disparos].sort((a, b) => b.lucro - a.lucro)
const topDisparos = porLucro.slice(0, 5)
const bottomDisparos = porLucro.slice(-5).reverse()

const custoPorFtd = totais.ftd > 0 ? totais.custo / totais.ftd : 0
const custoPorRegistro = totais.registros > 0 ? totais.custo / totais.registros : 0
const convFtd = totais.entregues > 0 ? (totais.ftd / totais.entregues) * 100 : 0
const txLidas = totais.entregues > 0 ? (totais.lidas / totais.entregues) * 100 : 0

const resultado = {
  periodo: { inicio: '01/06', fim: '30/06' },
  totais: { ...totais, custoPorFtd, custoPorRegistro, convFtd, txLidas },
  porCiclo,
  porCasa,
  porDia,
  melhorDia,
  topDisparos,
  bottomDisparos,
  disparos,
}

const conteudo = `// Gerado por scripts/gerar-resultados-junho-2026.mjs a partir de DISP_JUNHO_RESULTADO_OK.csv
// Nao editar a mao — rode o script novamente se o CSV mudar.
import type { ResultadosJunho2026 } from '@/types'

export const resultadosJunho2026: ResultadosJunho2026 = ${JSON.stringify(resultado, null, 2)}
`

writeFileSync(OUT_PATH, conteudo, 'utf-8')

console.log(`[gerar-resultados] ${disparos.length} disparos processados`)
console.log(`[gerar-resultados] totais:`, totais)
console.log(`[gerar-resultados] escrito em: ${OUT_PATH}`)
