// Parser do CSV histórico do Pilhado Prêmios (colunas: Data,Painel,Leads,Entregues,Lidos,
// % Entregues,% Lidos,Custo,Vendas,Faturamento,Ticket Médio,Conversão,ROI). Só importa os
// campos brutos (Leads→totalBase, Entregues, Lidos, Vendas, Faturamento) — tudo que é % ou
// calculado (Custo, Ticket Médio, Conversão, ROI) é recalculado pelo app, nunca importado.

function parseCsvLine(line: string): string[] {
  const campos: string[] = []
  let atual = ''
  let dentroAspas = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (dentroAspas) {
      if (ch === '"') {
        if (line[i + 1] === '"') { atual += '"'; i++ } else { dentroAspas = false }
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

function numeroBR(s: string | undefined): number {
  if (!s) return 0
  const limpo = s.replace(/R\$\s?/, '').replace('%', '').trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : 0
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
}

// "DD/MM" -> "YYYY-MM-DD", assumindo o ano corrente (o CSV não traz ano na coluna Data).
function dataParaIso(dataBR: string, ano: number): string {
  const [dd, mm] = dataBR.trim().split('/')
  return `${ano}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

export interface LinhaPilhadoCsv {
  data: string
  painel: string
  totalBase: number
  entregues: number
  lidas: number
  vendas: number
  faturamento: number
}

export function parseCsvPilhado(csvTexto: string, ano: number = new Date().getFullYear()): LinhaPilhadoCsv[] {
  const textoLimpo = csvTexto.replace(/^﻿/, '')
  const linhas = textoLimpo.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!linhas.length) throw new Error('CSV vazio')

  const header = parseCsvLine(linhas[0]).map(norm)
  const idx = {
    data: header.indexOf('DATA'),
    painel: header.indexOf('PAINEL'),
    leads: header.indexOf('LEADS'),
    entregues: header.indexOf('ENTREGUES'),
    lidos: header.indexOf('LIDOS'),
    vendas: header.indexOf('VENDAS'),
    faturamento: header.indexOf('FATURAMENTO'),
  }
  const faltando = Object.entries(idx).filter(([, i]) => i === -1).map(([k]) => k)
  if (faltando.length) throw new Error('Colunas não encontradas no CSV: ' + faltando.join(', '))

  return linhas.slice(1)
    .map((linha) => parseCsvLine(linha))
    .filter((c) => (c[idx.data] ?? '').trim())
    .map((c) => ({
      data: dataParaIso(c[idx.data], ano),
      painel: (c[idx.painel] ?? '').trim().toLowerCase(),
      totalBase: Math.round(numeroBR(c[idx.leads])),
      entregues: Math.round(numeroBR(c[idx.entregues])),
      lidas: Math.round(numeroBR(c[idx.lidos])),
      vendas: Math.round(numeroBR(c[idx.vendas])),
      faturamento: numeroBR(c[idx.faturamento]),
    }))
}
