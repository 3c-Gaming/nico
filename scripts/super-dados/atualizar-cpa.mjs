// Le DADOS-SUPER-JUNHO.csv, consulta a API de relatorio (mesma usada em
// scripts/weekly/weekly.js) linha a linha, por DATA + UTM/PID, e devolve o
// CSV igual, porem com REGISTROS, FTD e CPAS atualizados. A coluna CPA
// (valor em R$) fica em branco de proposito — é preenchida manualmente com
// formula depois.
//
// Uso:
//   node scripts/super-dados/atualizar-cpa.mjs
//   node scripts/super-dados/atualizar-cpa.mjs caminho/entrada.csv caminho/saida.csv

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ANO = 2026
const API_BASE = 'https://controlenumeros.vercel.app/api/campanhas/relatorio/utm'
const DELAY_MS = 150

// Mesmo mapeamento de scripts/weekly/weekly.js — nome da casa no CSV -> slug esperado pela API.
const CASA_MAP = {
  SuperBet: 'superbet',
  MGMBET: 'mgm',
  MGM: 'mgm',
  NoviBet: 'novibet',
}

const ARQUIVO_ENTRADA_PADRAO = resolve(__dirname, 'SUPER-JUNHO.csv')
const ARQUIVO_SAIDA_PADRAO = resolve(__dirname, 'SUPER-JUNHO-ATUALIZADO.csv')

const COL = {
  DATA: 0,
  CASA: 1,
  UTM: 2,
  REGISTROS: 16,
  FTD: 17,
  CPAS: 18,
  CPA: 19,
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Parser CSV com suporte a campos entre aspas (o CSV tem valores como "R$ 1.434,51").
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

function toCsvValue(value) {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function serializeCsvLine(campos) {
  return campos.map(toCsvValue).join(',')
}

// 14 -> "14,00" / 1160 -> "1.160,00"
function formatarInteiroBR(n) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

// "07/06" -> "2026-06-07"
function formatarDataApi(dataStr) {
  const match = dataStr.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const [, dd, mm] = match
  return `${ANO}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

async function consultarUTM(utm, casa, date) {
  const url = `${API_BASE}?utm=${encodeURIComponent(utm)}&casa=${encodeURIComponent(casa)}&date=${encodeURIComponent(date)}`
  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const json = await resp.json()
  return {
    registros: Number(json.registros) || 0,
    ftds: Number(json.ftds) || 0,
    cpas: Number(json.cpas) || 0,
  }
}

async function main() {
  const [, , argInput, argOutput] = process.argv
  const inputPath = argInput ? resolve(argInput) : ARQUIVO_ENTRADA_PADRAO
  const outputPath = argOutput ? resolve(argOutput) : ARQUIVO_SAIDA_PADRAO

  console.log(`Lendo: ${inputPath}`)
  const raw = readFileSync(inputPath, 'utf-8')
  const linhas = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const header = linhas[0]
  const corpo = linhas.slice(1)

  const linhasSaida = [header]

  let atualizadas = 0
  let comErro = 0

  for (let i = 0; i < corpo.length; i++) {
    const progresso = `[${i + 1}/${corpo.length}]`
    const campos = parseCsvLine(corpo[i])
    const data = (campos[COL.DATA] ?? '').trim()
    const casaCsv = (campos[COL.CASA] ?? '').trim()
    const utm = (campos[COL.UTM] ?? '').trim()

    const casaApi = CASA_MAP[casaCsv]
    const dateApi = formatarDataApi(data)

    if (!casaApi || !utm || !dateApi) {
      console.log(`${progresso} IGNORADA -> data=${data} casa=${casaCsv} utm=${utm}`)
      linhasSaida.push(serializeCsvLine(campos))
      continue
    }

    try {
      const resultado = await consultarUTM(utm, casaApi, dateApi)
      await sleep(DELAY_MS)

      campos[COL.REGISTROS] = formatarInteiroBR(resultado.registros)
      campos[COL.FTD] = formatarInteiroBR(resultado.ftds)
      campos[COL.CPAS] = formatarInteiroBR(resultado.cpas)
      campos[COL.CPA] = '' // preenchido manualmente depois, com formula

      console.log(
        `${progresso} OK -> utm=${utm} date=${dateApi} :: registros=${resultado.registros} ftds=${resultado.ftds} cpas=${resultado.cpas}`,
      )
      atualizadas++
    } catch (err) {
      console.log(`${progresso} ERRO -> utm=${utm} date=${dateApi} :: ${err.message} (mantendo valores originais)`)
      comErro++
    }

    linhasSaida.push(serializeCsvLine(campos))
  }

  writeFileSync(outputPath, linhasSaida.join('\n') + '\n', 'utf-8')

  console.log(`\nConcluído. ${atualizadas} linhas atualizadas, ${comErro} com erro (valores originais mantidos).`)
  console.log(`Arquivo salvo em: ${outputPath}`)
}

main()
