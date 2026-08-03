import type { AgregadoJunho, CicloDisparo, DisparoJunho, ResultadosJunho2026 } from '@/types'

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
function numeroBR(s: string | undefined): number {
  if (!s) return 0
  const limpo = s.replace(/R\$\s?/, '').replace('%', '').trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : 0
}

function classificarCiclo(nome: string): CicloDisparo {
  const m = nome.match(/\bD([1357])\b/)
  return m ? (`D${m[1]}` as CicloDisparo) : 'TOTAL'
}

// Mesma casa aparece com grafias diferentes entre meses (ex: "MGMBET" e "MGM") — normaliza
// pro nome canônico antes de agregar, senão vira duas linhas separadas em "por casa".
const CASA_CANONICA: Record<string, string> = { MGMBET: 'MGM' }
function normalizarCasa(casa: string): string {
  return CASA_CANONICA[casa.toUpperCase()] ?? casa
}

// Os CSVs de disparos mudam de layout mês a mês (colunas reordenadas, CLIQUES/TX LIDAS/TX
// CLIQUES às vezes nem existem) — por isso mapeamos por nome de cabeçalho em vez de índice fixo.
const norm = (h: string) => h.trim().toUpperCase().replace(/\s+/g, ' ')
const ALIASES: Record<string, string[]> = {
  DATA: ['DATA'],
  CASA: ['CASA'],
  PROMO: ['PROMOÇÃO/OBJETIVO', 'PROMOCAO/OBJETIVO', 'PROMOÇÃO', 'PROMOCAO'],
  UTM: ['UTM/PID', 'UTMS / PIDS', 'UTMS/PIDS', 'UTM / PID', 'UTMS', 'PIDS'],
  LUCRO: ['LUCRO/PREJUIZO', 'LUCRO/PREJUÍZO'],
  ROAS: ['ROAS'],
  ENTREGUES: ['ENTREGUES'],
  LIDAS: ['LIDAS'],
  CLIQUES: ['CLIQUES'],
  CUSTO: ['CUSTO'],
  REGISTROS: ['REGISTROS'],
  FTD: ['FTD', 'FTDS'],
  CPAS: ['CPAS'],
  CPA_VAL: ['CPA'],
}

interface ColunasIdx {
  DATA: number
  CASA: number
  PROMO: number
  UTM: number
  LUCRO: number
  ROAS: number
  ENTREGUES: number
  LIDAS: number
  CLIQUES?: number
  CUSTO: number
  REGISTROS: number
  FTD: number
  CPAS: number
  CPA_VAL: number
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
  const obrigatorias = ['DATA', 'CASA', 'PROMO', 'UTM', 'LUCRO', 'ROAS', 'ENTREGUES', 'LIDAS', 'CUSTO', 'REGISTROS', 'FTD', 'CPAS', 'CPA_VAL']
  const faltando = obrigatorias.filter((k) => idx[k] === undefined)
  if (faltando.length) throw new Error('Colunas não encontradas no CSV: ' + faltando.join(', '))
  return idx as unknown as ColunasIdx
}

function agregadoVazio(): AgregadoJunho {
  return { disparos: 0, entregues: 0, lidas: 0, custo: 0, faturamento: 0, lucro: 0, registros: 0, ftd: 0, cpas: 0, roas: 0 }
}

function acumular(agg: AgregadoJunho, d: DisparoJunho) {
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

function fecharRoas(agg: AgregadoJunho): AgregadoJunho {
  agg.roas = agg.custo > 0 ? agg.faturamento / agg.custo : 0
  return agg
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Só o parsing do CSV pra uma lista de disparos — sem agregar. Reutilizável quando precisamos
// combinar disparos de mais de um CSV/mês antes de fechar os totais (ex: recorte por período
// que atravessa dois meses).
export function parseCsvDisparos(csvTexto: string): DisparoJunho[] {
  const textoLimpo = csvTexto.replace(/^﻿/, '')
  const linhas = textoLimpo.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!linhas.length) throw new Error('CSV vazio')

  const idx = mapearColunas(parseCsvLine(linhas[0]))

  // A última linha costuma ser um agregado "TOTAIS" (data/casa vazios, só números) — descarta.
  const ultimaLinha = parseCsvLine(linhas[linhas.length - 1])
  const ultimaTemData = (ultimaLinha[idx.DATA] ?? '').trim().length > 0
  const corpoLinhas = linhas.slice(1, ultimaTemData ? undefined : -1)

  return corpoLinhas
    .map((linha) => {
      const c = parseCsvLine(linha)
      const casaBruta = (c[idx.CASA] ?? '').trim()
      const nome = (c[idx.PROMO] ?? '').trim()
      const utm = (c[idx.UTM] ?? '').trim()
      return {
        data: (c[idx.DATA] ?? '').trim(),
        casa: normalizarCasa(casaBruta),
        utm,
        nome,
        ciclo: classificarCiclo(nome),
        lucro: round2(numeroBR(c[idx.LUCRO])),
        roas: numeroBR(c[idx.ROAS]),
        entregues: numeroBR(c[idx.ENTREGUES]),
        lidas: numeroBR(c[idx.LIDAS]),
        cliques: idx.CLIQUES !== undefined ? numeroBR(c[idx.CLIQUES]) : 0,
        custo: round2(numeroBR(c[idx.CUSTO])),
        registros: numeroBR(c[idx.REGISTROS]),
        ftd: numeroBR(c[idx.FTD]),
        cpas: numeroBR(c[idx.CPAS]),
        cpaReceita: round2(numeroBR(c[idx.CPA_VAL])),
      }
    })
    // descarta só linhas sem data — sem casa reconhecida (ex: placeholder "Selecione" de dropdown
    // vazio) ainda conta pros totais gerais (o custo é real), só fica de fora do "por casa"
    .filter((d) => d.data)
}

// Fecha os totais/agregados a partir de uma lista de disparos já parseada (de um ou mais CSVs).
export function construirResultado(disparos: DisparoJunho[], periodo: { inicio: string; fim: string }): ResultadosJunho2026 {
  const totais = agregadoVazio()
  for (const d of disparos) acumular(totais, d)
  fecharRoas(totais)

  const porCiclo: Record<CicloDisparo, AgregadoJunho> = {
    D1: agregadoVazio(),
    D3: agregadoVazio(),
    D5: agregadoVazio(),
    D7: agregadoVazio(),
    TOTAL: agregadoVazio(),
  }
  for (const d of disparos) acumular(porCiclo[d.ciclo], d)
  for (const k of Object.keys(porCiclo) as CicloDisparo[]) fecharRoas(porCiclo[k])

  const porCasa: Record<string, AgregadoJunho> = {}
  for (const d of disparos) {
    if (!d.casa || d.casa.toUpperCase() === 'SELECIONE') continue
    if (!porCasa[d.casa]) porCasa[d.casa] = agregadoVazio()
    acumular(porCasa[d.casa], d)
  }
  for (const k of Object.keys(porCasa)) fecharRoas(porCasa[k])

  const porDiaMap = new Map<string, { data: string; lucro: number; entregues: number; ftd: number }>()
  for (const d of disparos) {
    if (!porDiaMap.has(d.data)) porDiaMap.set(d.data, { data: d.data, lucro: 0, entregues: 0, ftd: 0 })
    const dia = porDiaMap.get(d.data)!
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

  return {
    periodo,
    totais: { ...totais, custoPorFtd, custoPorRegistro, convFtd, txLidas },
    porCiclo,
    porCasa,
    porDia,
    melhorDia,
    topDisparos,
    bottomDisparos,
    disparos,
  }
}

export function processarCsvResultados(csvTexto: string, periodo: { inicio: string; fim: string }): ResultadosJunho2026 {
  return construirResultado(parseCsvDisparos(csvTexto), periodo)
}
