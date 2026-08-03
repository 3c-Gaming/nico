import type { AgregadoJunho, ItemSegundaCasa, ResultadosJunho2026 } from '@/types'

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

// "R$ 4.710,50" / "1.234,00" -> 4710.5 / 1234
function numeroBR(s: string | undefined): number {
  if (!s) return 0
  const limpo = s.replace(/R\$\s?/, '').trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : 0
}

const CASA_CANONICA: Record<string, string> = {
  MGM: 'MGM',
  MGMBET: 'MGM',
  SUPER: 'SuperBet',
  SUPERBET: 'SuperBet',
  NOVIBET: 'NoviBet',
  NOVI: 'NoviBet',
  KINGPANDA: 'KingPanda',
}
function normalizarCasa(raw: string): string {
  const chave = raw.trim().toUpperCase()
  return CASA_CANONICA[chave] ?? raw.trim()
}

// CSV de "segunda casa": colunas fixas CASA, REG, FTD, CPA (contagem), CPA (valor em R$) —
// nessa ordem, sem data/promoção (é um agregado do período, não por disparo).
export function processarCsvSegundaCasa(csvTexto: string): ItemSegundaCasa[] {
  const texto = csvTexto.replace(/^﻿/, '')
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!linhas.length) throw new Error('CSV vazio')

  const corpo = linhas.slice(1) // descarta o cabeçalho

  return corpo
    .map((linha) => {
      const c = parseCsvLine(linha)
      return {
        casa: normalizarCasa(c[0] ?? ''),
        registros: numeroBR(c[1]),
        ftd: numeroBR(c[2]),
        cpas: numeroBR(c[3]),
        faturamento: numeroBR(c[4]),
      }
    })
    .filter((d) => d.casa.length > 0)
}

function agregadoVazio(): AgregadoJunho {
  return { disparos: 0, entregues: 0, lidas: 0, custo: 0, faturamento: 0, lucro: 0, registros: 0, ftd: 0, cpas: 0, roas: 0 }
}

// Soma os destaques de segunda casa nos totais e no "por casa" — sem custo próprio, então
// entram inteiros como lucro. Não mexe em disparos/porDia/porCiclo/rankings (não tem data).
export function aplicarSegundaCasa(dados: ResultadosJunho2026, segundaCasa: ItemSegundaCasa[] | undefined): ResultadosJunho2026 {
  if (!segundaCasa?.length) return dados

  const extra = segundaCasa.reduce(
    (acc, d) => ({
      registros: acc.registros + d.registros,
      ftd: acc.ftd + d.ftd,
      cpas: acc.cpas + d.cpas,
      faturamento: acc.faturamento + d.faturamento,
    }),
    { registros: 0, ftd: 0, cpas: 0, faturamento: 0 },
  )

  const totais = {
    ...dados.totais,
    registros: dados.totais.registros + extra.registros,
    ftd: dados.totais.ftd + extra.ftd,
    cpas: dados.totais.cpas + extra.cpas,
    faturamento: dados.totais.faturamento + extra.faturamento,
    lucro: dados.totais.lucro + extra.faturamento,
  }
  totais.roas = totais.custo > 0 ? totais.faturamento / totais.custo : 0

  const porCasa = { ...dados.porCasa }
  for (const item of segundaCasa) {
    const atual = porCasa[item.casa] ?? agregadoVazio()
    const novo = {
      ...atual,
      registros: atual.registros + item.registros,
      ftd: atual.ftd + item.ftd,
      cpas: atual.cpas + item.cpas,
      faturamento: atual.faturamento + item.faturamento,
      lucro: atual.lucro + item.faturamento,
    }
    novo.roas = novo.custo > 0 ? novo.faturamento / novo.custo : 0
    porCasa[item.casa] = novo
  }

  return { ...dados, totais, porCasa }
}
