import { NextRequest, NextResponse } from 'next/server'
import { enviarCampanhaSms, type DestinatarioSms } from '@/lib/smsCampanha'

interface EnviarBody {
  campanha: string
  from: string
  corpo: string
  useShortener?: boolean
  destinatarios: DestinatarioSms[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EnviarBody
    if (!body.campanha || !body.from || !body.corpo || !Array.isArray(body.destinatarios) || body.destinatarios.length === 0) {
      return NextResponse.json({ error: 'campanha, from, corpo e destinatarios são obrigatórios' }, { status: 400 })
    }

    // Deriva do próprio request (não hardcoded) — funciona em produção e em preview deployments;
    // em localhost a Solvefy simplesmente não vai conseguir alcançar essa URL, então nenhum
    // callback chega (comportamento aceitável em dev — só produção recebe clique/status via
    // webhook de verdade).
    const callbackUrl = `${request.nextUrl.origin}/api/sms/webhook`

    const resultado = await enviarCampanhaSms({
      campanha: body.campanha,
      from: body.from,
      corpo: body.corpo,
      useShortener: body.useShortener,
      destinatarios: body.destinatarios,
      callbackUrl,
    })

    return NextResponse.json(resultado)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
