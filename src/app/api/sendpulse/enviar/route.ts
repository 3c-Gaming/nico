import { NextRequest, NextResponse } from 'next/server'
import { listarNumeros } from '@/lib/integrações/sendpulse'

export async function POST(request: NextRequest) {
  try {
    const { botId, telefone } = await request.json()

    if (!botId || !telefone) {
      return NextResponse.json({ error: 'botId e telefone são obrigatórios' }, { status: 400 })
    }

    const numeros = await listarNumeros(AbortSignal.timeout(15_000))
    const bot = numeros.find((n) => n.id === botId)
    if (!bot) {
      return NextResponse.json({ error: 'Número/bot não encontrado' }, { status: 404 })
    }

    if (bot.status !== 'ativo') {
      return NextResponse.json({ error: 'Número/bot não está ativo' }, { status: 400 })
    }

    const { enviarMensagem } = await import('@/lib/integrações/sendpulse')
    const resultado = await enviarMensagem({
      botId,
      telefone,
      templateId: 'template_padrao',
    })

    return NextResponse.json(resultado)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
