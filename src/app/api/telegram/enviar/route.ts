import { NextRequest, NextResponse } from 'next/server'
import { enviarCampanhaTelegram, type DestinatarioTelegram } from '@/lib/telegramCampanha'

interface EnviarBody {
  campanha: string
  corpo: string
  botIdentificador: string
  destinatarios: DestinatarioTelegram[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EnviarBody
    if (!body.campanha || !body.corpo || !body.botIdentificador || !Array.isArray(body.destinatarios) || body.destinatarios.length === 0) {
      return NextResponse.json({ error: 'campanha, corpo, botIdentificador e destinatarios são obrigatórios' }, { status: 400 })
    }

    const resultado = await enviarCampanhaTelegram({
      campanha: body.campanha,
      corpo: body.corpo,
      botIdentificador: body.botIdentificador,
      destinatarios: body.destinatarios,
    })

    return NextResponse.json(resultado)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
