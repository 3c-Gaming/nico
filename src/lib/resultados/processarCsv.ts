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

export function processarCsvResultados(csvTexto: string, periodo: { inicio: string; fim: string }): ResultadosJunho2026 {
  const linhas = csvTexto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const corpo = linhas.slice(1, -1) // remove header e linha TOTAIS

  const disparos: DisparoJunho[] = corpo.map((linha) => {
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
