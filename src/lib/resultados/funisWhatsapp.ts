import type { AgregadoJunho, FunilWhatsappItem, FunisWhatsappDados, ResultadosJunho2026 } from '@/types'

function parseCsvLine(line: string): string[] {
  const campos: string[] = []
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
    } else if (ch === ',' || ch === ';') {
      campos.push(atual)
      atual = ''
    } else {
      atual += ch
    }
  }
  campos.push(atual)
  return campos
}

// "1.234" / "1.234,00" / "12" -> 1234 / 1234 / 12
function numeroBR(s: string | undefined): number {
  if (!s) return 0
  const limpo = s.replace(/\./g, '').replace(',', '.').trim()
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : 0
}

const norm = (h: string) => h.trim().toUpperCase().replace(/\s+/g, ' ')
const ALIASES: Record<string, string[]> = {
  DATA: ['DATA', 'DATE', 'DIA'],
  FUNIL: ['FUNIL', 'FUNNEL', 'FLUXO'],
  CASA: ['CASA', 'BETHOUSE', 'HOUSE', 'BOOKMAKER'],
  SITEID: ['SITEID', 'SITE ID', 'SITE_ID', 'SITE', 'ACID', 'PID'],
  REGISTROS: ['REGISTROS', 'REG', 'REGS', 'REGISTRATIONS'],
  FTDS: ['FTDS', 'FTD'],
  CPAS: ['CPAS', 'CPA'],
}

interface ColunasIdx {
  DATA?: number
  CASA?: number
  CPAS?: number
  FUNIL: number
  SITEID: number
  REGISTROS: number
  FTDS: number
}

function mapearColunas(header: string[]): ColunasIdx {
  const idx: Partial<Record<string, number>> = {}
  const cols = header.map(norm)
  for (const [chave, nomes] of Object.entries(ALIASES)) {
    for (const nome of nomes) {
      const i = cols.indexOf(norm(nome))
      if (i !== -1) {
        idx[chave] = i
        break
      }
    }
  }
  const faltando = (['FUNIL', 'SITEID', 'REGISTROS', 'FTDS'] as const).filter((k) => idx[k] === undefined)
  if (faltando.length) {
    throw new Error(
      'Colunas não encontradas no CSV de funis de WhatsApp: ' +
        faltando.join(', ') +
        '. Esperado: DATA, FUNIL, CASA, SITEID, REGISTROS, FTDS (DATA e CASA opcionais).',
    )
  }
  return idx as unknown as ColunasIdx
}

// "2026-08-05" / "05/08/2026" / "05/08" -> "05/08"
function diaMes(bruto: string): string {
  const s = bruto.trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}`
  const br = s.match(/^(\d{1,2})\/(\d{1,2})/)
  if (br) return `${br[1].padStart(2, '0')}/${br[2].padStart(2, '0')}`
  return s
}

// ordena "DD/MM" cronologicamente
function cmpDiaMes(a: string, b: string): number {
  const [da, ma] = a.split('/').map(Number)
  const [db, mb] = b.split('/').map(Number)
  return (ma || 0) - (mb || 0) || (da || 0) - (db || 0)
}

const SEP = '~~'

/**
 * Lê o CSV de funis de WhatsApp (DATA, FUNIL, CASA, SITEID, REGISTROS, FTDS) e agrega por funil,
 * com a quebra por (casa, site id) embutida em cada funil. DATA e CASA são opcionais — DATA só
 * serve pra rotular o período de cada site id; sem CASA, tudo cai num balde único.
 */
export function processarCsvFunisWhatsapp(csvTexto: string): FunisWhatsappDados {
  const textoLimpo = csvTexto.replace(/^﻿/, '')
  const linhas = textoLimpo.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!linhas.length) throw new Error('CSV vazio')

  const idx = mapearColunas(parseCsvLine(linhas[0]))

  // funil -> "casa~~siteId" -> { registros, ftds, cpas }
  const porFunil = new Map<string, Map<string, { registros: number; ftds: number; cpas: number }>>()
  const ordemFunil: string[] = []
  const casas: string[] = []
  const siteIds: string[] = []
  const datasPorSite = new Map<string, string[]>()

  for (const linha of linhas.slice(1)) {
    const c = parseCsvLine(linha)
    const funil = (c[idx.FUNIL] ?? '').trim()
    const siteId = (c[idx.SITEID] ?? '').trim()
    if (!funil || !siteId) continue
    const casa = idx.CASA !== undefined ? (c[idx.CASA] ?? '').trim() : ''

    const registros = numeroBR(c[idx.REGISTROS])
    const ftds = numeroBR(c[idx.FTDS])
    const cpas = idx.CPAS !== undefined ? numeroBR(c[idx.CPAS]) : 0

    if (!porFunil.has(funil)) {
      porFunil.set(funil, new Map())
      ordemFunil.push(funil)
    }
    const chaveCelula = `${casa}${SEP}${siteId}`
    const celulasMap = porFunil.get(funil)!
    if (!celulasMap.has(chaveCelula)) celulasMap.set(chaveCelula, { registros: 0, ftds: 0, cpas: 0 })
    const acc = celulasMap.get(chaveCelula)!
    acc.registros += registros
    acc.ftds += ftds
    acc.cpas += cpas

    if (casa && !casas.includes(casa)) casas.push(casa)
    if (!siteIds.includes(siteId)) siteIds.push(siteId)

    if (idx.DATA !== undefined) {
      const dm = diaMes(c[idx.DATA] ?? '')
      if (dm) {
        if (!datasPorSite.has(siteId)) datasPorSite.set(siteId, [])
        datasPorSite.get(siteId)!.push(dm)
      }
    }
  }

  const itens: FunilWhatsappItem[] = ordemFunil.map((funil) => {
    const celulasMap = porFunil.get(funil)!
    const celulas = [...celulasMap.entries()].map(([chaveCelula, v]) => {
      const [casa, siteId] = chaveCelula.split(SEP)
      return { casa, siteId, ...v }
    })
    return {
      funil,
      registros: celulas.reduce((s, x) => s + x.registros, 0),
      ftds: celulas.reduce((s, x) => s + x.ftds, 0),
      cpas: celulas.reduce((s, x) => s + x.cpas, 0),
      celulas,
    }
  })

  const periodoPorSite: Record<string, { inicio: string; fim: string }> = {}
  for (const s of siteIds) {
    const datas = (datasPorSite.get(s) ?? []).sort(cmpDiaMes)
    if (datas.length) periodoPorSite[s] = { inicio: datas[0], fim: datas[datas.length - 1] }
  }

  return { itens, casas, siteIds, periodoPorSite }
}

// SuperBet / BetMGM / etc no CSV podem vir com grafias diferentes das usadas no "por casa" dos
// disparos (ex: "BetMGM" vs "MGM") — normaliza pro nome canônico antes de somar.
function canonCasa(raw: string): string {
  const u = raw.trim().toUpperCase()
  if (u.includes('MGM')) return 'MGM'
  if (u.includes('SUPER')) return 'SuperBet'
  if (u.includes('NOVI')) return 'NoviBet'
  if (u.includes('KING')) return 'KingPanda'
  if (u.includes('BETE')) return 'BeteEsporte'
  return raw.trim()
}

function agregadoVazio(): AgregadoJunho {
  return { disparos: 0, entregues: 0, lidas: 0, custo: 0, faturamento: 0, lucro: 0, registros: 0, ftd: 0, cpas: 0, roas: 0 }
}

/**
 * "Por casa" com os registros/FTDs dos funis de WhatsApp somados — só reg/FTD, sem tocar em
 * lucro/faturamento/custo/roas (FTD de tráfego de WhatsApp não entra no resultado financeiro da
 * apresentação). Cria a casa se ela não existir nos disparos (ex: BetMGM sem disparo no mês).
 */
export function porCasaComFunisWhatsapp(dados: ResultadosJunho2026): Record<string, AgregadoJunho> {
  const base: Record<string, AgregadoJunho> = {}
  for (const [casa, agg] of Object.entries(dados.porCasa)) base[casa] = { ...agg }

  const fw = dados.funisWhatsapp
  if (!fw?.itens?.length) return base

  for (const it of fw.itens) {
    for (const cel of it.celulas) {
      const casa = canonCasa(cel.casa)
      if (!casa) continue
      if (!base[casa]) base[casa] = agregadoVazio()
      base[casa].registros += cel.registros
      base[casa].ftd += cel.ftds
      base[casa].cpas += cel.cpas
    }
  }
  return base
}
