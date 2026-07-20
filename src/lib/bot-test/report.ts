import type { BotTestResult } from './types'

function formatarHorario(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatarDuracao(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const FRASES_OK = [
  'Tudo funcionando perfeitamente~',
  'Nenhum problema encontrado!',
  'Os bots estao respondendo super bem!',
  'Todos os canais estao ativos!',
  'Checkup completo, tudo certo!',
]

const FRASES_ERRO = [
  'Hmm... teve algum erro aqui...',
  'Opa, algo deu errado...',
  'Precisamos dar uma olhada nisso...',
]

const FRASES_SEM_RESPOSTA = [
  'Alguns bots nao responderam...',
  'Teve silencio em alguns canais...',
]

const FRASES_AVISO = [
  'Alguns bots precisam de atencao...',
  'Tem bot precisando de interacao manual...',
]

function fraseAleatoria(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function formatarRelatorio(resultados: BotTestResult[]): string {
  const agora = new Date()
  const data = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`

  const ok = resultados.filter((r) => r.status === 'ok').length
  const erros = resultados.filter((r) => r.status === 'erro').length
  const avisos = resultados.filter((r) => r.status === 'aviso').length
  const semResposta = resultados.filter((r) => r.status === 'sem_resposta' || r.status === 'pendente').length
  const total = resultados.length

  const linhas: string[] = []

  linhas.push(`_*✧ Relatório de Bots ✧*_`)
  linhas.push(`_${data} ~ ${hora}_`)
  linhas.push('')

  for (const r of resultados) {
    const nome = r.nome || r.botId
    const horario = formatarHorario(r.ultimoTeste)

    if (r.status === 'ok') {
      linhas.push(`*${nome}*  ✅ _OK_ _(${formatarDuracao(r.duracaoMs)})_  ⏱ ${horario}`)
    } else if (r.status === 'aviso') {
      linhas.push(`*${nome}*  ⚠️ _AVISO_  ⏱ ${horario}`)
      linhas.push(`> _O contact_id precisa de interação manual para voltar a ser testado._`)
    } else if (r.status === 'erro') {
      linhas.push(`*${nome}*  ❌ _ERRO_  ⏱ ${horario}`)
      if (r.erro) {
        const erroCurto = r.erro.length > 80 ? r.erro.slice(0, 80) + '...' : r.erro
        linhas.push(`> _${erroCurto}_`)
      }
    } else {
      linhas.push(`*${nome}*  ⏳ _SEM RESPOSTA_  ⏱ ${horario}`)
    }
  }

  linhas.push('')
  linhas.push('```')
  linhas.push(`  ✅  ${ok} ok    ⚠️  ${avisos} aviso    ❌  ${erros} erro    ⏳  ${semResposta} sem resp    📊  ${total} total`)
  linhas.push('```')
  linhas.push('')

  if (erros === 0 && semResposta === 0 && avisos === 0) {
    linhas.push(`_*${fraseAleatoria(FRASES_OK)}*_ ✨`)
  } else if (avisos > 0 && erros === 0 && semResposta === 0) {
    linhas.push(`_*${fraseAleatoria(FRASES_AVISO)}*_`)
  } else if (erros > 0) {
    linhas.push(`_*${fraseAleatoria(FRASES_ERRO)}*_`)
  } else {
    linhas.push(`_*${fraseAleatoria(FRASES_SEM_RESPOSTA)}*_`)
  }

  return linhas.join('\n')
}
