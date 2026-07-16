import { NextResponse } from 'next/server'
import { obterBots } from '@/lib/bot-test/bot-list'
import { executarTesteManual } from '@/lib/bot-test/runner'
import { listarResultados } from '@/lib/bot-test/store'
import { enviarMensagemGrupo } from '@/lib/integrações/whapi'
import { formatarRelatorio } from '@/lib/bot-test/report'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { botId: botIdParam, sendReport } = body

  if (!botIdParam) {
    return NextResponse.json({ erro: 'Informe um botId valido' }, { status: 400 })
  }

  const bots = await obterBots()
  const botExiste = bots.some((b) => b.botId === botIdParam)
  if (!botExiste) {
    return NextResponse.json({ erro: 'Bot nao encontrado na API SendPulse' }, { status: 400 })
  }

  const resultado = await executarTesteManual(botIdParam)

  if (sendReport) {
    const groupId = process.env.WHAPI_GROUP_ID
    if (groupId) {
      try {
        const todos = await listarResultados()
        const relatorio = formatarRelatorio(todos)
        await enviarMensagemGrupo({ groupId, texto: relatorio })
      } catch (err) {
        console.error('[bot-test/run] Erro ao enviar relatório:', (err as Error).message)
      }
    }
  }

  return NextResponse.json({ executado: true, ...resultado })
}
