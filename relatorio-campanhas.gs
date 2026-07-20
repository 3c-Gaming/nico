// ============================================
// CONFIGURAÇÃO — trocar pelos domínios reais
// ============================================
const API_BASE = 'https://controlenumeros.vercel.app'
const DAXX_BRIDGE = 'https://nico-g3g3.onrender.com'

// Colunas da planilha (letras)
const COL = {
  DATA: 'A',
  CASA: 'B',
  NOME: 'C',
  UTM: 'D',
  ENTREGUES: 'G',
  REGISTROS: 'M',
  FTD: 'N',
  CPA: 'O',
}

// ============================================
// MENU
// ============================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Relatório DAXX')
    .addItem('▶ Buscar resultados', 'buscarResultados')
    .addToUi()
}

// ============================================
// FLUXO PRINCIPAL
// ============================================
function buscarResultados() {
  const sheet = SpreadsheetApp.getActiveSheet()
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('Nenhum dado encontrado (comece na linha 2).')
    return
  }

  const logSheet = getOrCreateLogSheet()
  logSheet.clear()
  logSheet.getRange('A1').setValue('Iniciando refresh da DAXX...')
  SpreadsheetApp.flush()

  // 1) Refresh da DAXX — scrape fresco
  try {
    const refreshRes = UrlFetchApp.fetch(`${DAXX_BRIDGE}/campanhas/refresh`, {
      muteHttpExceptions: true,
      headers: { Accept: 'application/json' },
    })
    if (refreshRes.getResponseCode() !== 200) {
      logSheet.getRange('A1').setValue(`Erro no refresh DAXX: ${refreshRes.getResponseCode()}`)
      return
    }
    logSheet.getRange('A1').setValue('DAXX atualizada. Buscando resultados...')
    SpreadsheetApp.flush()
  } catch (e) {
    logSheet.getRange('A1').setValue(`Erro de conexão com DAXX: ${e.message}`)
    return
  }

  // 2) Ler dados da planilha
  const data = sheet.getRange(`${COL.DATA}2:${COL.DATA}${lastRow}`).getValues()
  const casas = sheet.getRange(`${COL.CASA}2:${COL.CASA}${lastRow}`).getValues()
  const nomes = sheet.getRange(`${COL.NOME}2:${COL.NOME}${lastRow}`).getValues()
  const utms = sheet.getRange(`${COL.UTM}2:${COL.UTM}${lastRow}`).getValues()

  let processadas = 0
  let erros = 0

  for (let i = 0; i < data.length; i++) {
    const row = i + 2
    const rawDate = data[i][0]
    const casa = String(casas[i][0]).trim()
    const nome = String(nomes[i][0]).trim()
    const utm = String(utms[i][0]).trim()

    if (!rawDate || !casa || !utm) continue

    const date = normalizeDate(rawDate)
    if (!date) {
      logSheet.getRange(`A${row}`).setValue(`Linha ${row}: data inválida "${rawDate}"`)
      erros++
      continue
    }

    try {
      const params = [
        `date=${encodeURIComponent(date)}`,
        `utm=${encodeURIComponent(utm)}`,
        `casa=${encodeURIComponent(casa)}`,
        nome ? `nome=${encodeURIComponent(nome)}` : '',
      ]
        .filter(Boolean)
        .join('&')

      const res = UrlFetchApp.fetch(`${API_BASE}/api/campanhas/relatorio?${params}`, {
        muteHttpExceptions: true,
        headers: { Accept: 'application/json' },
      })

      if (res.getResponseCode() !== 200) {
        logSheet.getRange(`A${row}`).setValue(`Linha ${row}: HTTP ${res.getResponseCode()}`)
        erros++
        continue
      }

      const json = JSON.parse(res.getContentText())

      sheet.getRange(`${COL.ENTREGUES}${row}`).setValue(json.entregues || 0)
      sheet.getRange(`${COL.REGISTROS}${row}`).setValue(json.registros || 0)
      sheet.getRange(`${COL.FTD}${row}`).setValue(json.ftds || 0)
      sheet.getRange(`${COL.CPA}${row}`).setValue(json.cpas || 0)

      processadas++
      logSheet.getRange(`A${row}`).setValue(`Linha ${row}: OK`)
    } catch (e) {
      logSheet.getRange(`A${row}`).setValue(`Linha ${row}: ${e.message}`)
      erros++
    }

    if (i % 10 === 9) {
      Utilities.sleep(1000)
      SpreadsheetApp.flush()
    }
  }

  const total = processadas + erros
  logSheet.getRange('A1').setValue(`Concluído: ${processadas}/${total} linhas processadas, ${erros} erros.`)
  SpreadsheetApp.getUi().alert(
    `Concluído!\n${processadas} linhas preenchidas\n${erros} erros (verificar aba "Log")`,
  )
}

// ============================================
// UTILIDADES
// ============================================

function normalizeDate(val) {
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(val).trim()
  const ddmmyyyy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

function getOrCreateLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let logSheet = ss.getSheetByName('Log')
  if (!logSheet) {
    logSheet = ss.insertSheet('Log')
  }
  return logSheet
}
