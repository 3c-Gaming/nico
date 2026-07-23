import type { AnaliseBaseDaxx } from '@/types'

const DDD_PARA_UF: Record<string, string> = {
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  '27': 'ES', '28': 'ES',
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  '47': 'SC', '48': 'SC', '49': 'SC',
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  '61': 'DF',
  '62': 'GO', '64': 'GO',
  '63': 'TO',
  '65': 'MT', '66': 'MT',
  '67': 'MS',
  '68': 'AC',
  '69': 'RO',
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  '79': 'SE',
  '81': 'PE', '87': 'PE',
  '82': 'AL',
  '83': 'PB',
  '84': 'RN',
  '85': 'CE', '88': 'CE',
  '86': 'PI', '89': 'PI',
  '91': 'PA', '93': 'PA', '94': 'PA',
  '92': 'AM', '97': 'AM',
  '95': 'RR',
  '96': 'AP',
  '98': 'MA', '99': 'MA',
}

const FAIXAS_LEITURA = [
  { label: '< 5min', maxSegundos: 5 * 60 },
  { label: '5-30min', maxSegundos: 30 * 60 },
  { label: '30min-2h', maxSegundos: 2 * 60 * 60 },
  { label: '2h-12h', maxSegundos: 12 * 60 * 60 },
  { label: '12h-24h', maxSegundos: 24 * 60 * 60 },
  { label: '> 24h', maxSegundos: Infinity },
]

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

function parseDataDaxxCompleta(s: string): Date | null {
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, dd, mm, yyyy, hh, mi, ss] = match
  return new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss)
}

function extrairDDD(numero: string): string | null {
  // formato esperado: 55DDNNNNNNNNN (Brasil)
  const semPais = numero.startsWith('55') ? numero.slice(2) : numero
  const ddd = semPais.slice(0, 2)
  return DDD_PARA_UF[ddd] ? ddd : null
}

function media(valores: number[]): number {
  if (!valores.length) return 0
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0
  const ordenado = [...valores].sort((a, b) => a - b)
  return ordenado[Math.floor(ordenado.length / 2)]
}

export function analisarBaseCsv(csvText: string): AnaliseBaseDaxx {
  const linhas = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const corpo = linhas.slice(1)

  let entregues = 0
  let lidos = 0
  let falhas = 0
  let pendentes = 0
  let optOuts = 0

  const temposEntrega: number[] = []
  const temposLeitura: number[] = []
  const faixasLeituraCount = FAIXAS_LEITURA.map((f) => ({ label: f.label, total: 0 }))
  const dddCount = new Map<string, number>()
  const falhasLista: { numero: string; erroDescricao: string | null }[] = []
  const optOutsLista: string[] = []

  for (const linha of corpo) {
    const c = parseCsvLine(linha)
    const numero = (c[0] ?? '').trim()
    const enviadoStr = (c[1] ?? '').trim()
    const status = (c[2] ?? '').trim()
    const entregueStr = (c[3] ?? '').trim()
    const lidoStr = (c[4] ?? '').trim()
    const erroDescStr = (c[6] ?? '').trim()
    const optOutStr = (c[7] ?? '').trim()

    if (status === 'Entregue') entregues++
    else if (status === 'Lido') lidos++
    else if (status === 'Falha') falhas++
    else if (status === 'Pendente') pendentes++

    if (status === 'Falha') {
      const erroDescricao = erroDescStr && erroDescStr !== '—' ? erroDescStr : null
      falhasLista.push({ numero, erroDescricao })
    }

    if (optOutStr === 'Sim') {
      optOuts++
      optOutsLista.push(numero)
    }

    const enviado = parseDataDaxxCompleta(enviadoStr)
    const entregue = entregueStr !== '—' ? parseDataDaxxCompleta(entregueStr) : null
    const lido = lidoStr !== '—' ? parseDataDaxxCompleta(lidoStr) : null

    if (enviado && entregue) {
      temposEntrega.push((entregue.getTime() - enviado.getTime()) / 1000)
    }
    if (enviado && lido) {
      const segundos = (lido.getTime() - enviado.getTime()) / 1000
      temposLeitura.push(segundos)
      const faixaIdx = FAIXAS_LEITURA.findIndex((f) => segundos <= f.maxSegundos)
      if (faixaIdx >= 0) faixasLeituraCount[faixaIdx].total++
    }

    const ddd = extrairDDD(numero)
    if (ddd) dddCount.set(ddd, (dddCount.get(ddd) ?? 0) + 1)
  }

  const total = corpo.length
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0)

  const distribuicaoDdd = [...dddCount.entries()]
    .map(([ddd, total]) => ({ ddd, uf: DDD_PARA_UF[ddd], total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return {
    total,
    entregues,
    lidos,
    falhas,
    pendentes,
    pctEntregues: pct(entregues),
    pctLidos: pct(lidos),
    pctFalhas: pct(falhas),
    pctPendentes: pct(pendentes),
    taxaEntregaTotal: pct(entregues + lidos),
    optOuts,
    pctOptOuts: pct(optOuts),
    tempoEntregaMedioSeg: Math.round(media(temposEntrega)),
    tempoEntregaMedianaSeg: Math.round(mediana(temposEntrega)),
    tempoLeituraMedioSeg: Math.round(media(temposLeitura)),
    tempoLeituraMedianaSeg: Math.round(mediana(temposLeitura)),
    faixasLeitura: faixasLeituraCount,
    distribuicaoDdd,
    falhasLista,
    optOutsLista,
  }
}
