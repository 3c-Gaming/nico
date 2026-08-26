import { NextResponse } from 'next/server'
import { listarDisparos, atualizarDisparo } from '@/lib/api-store'
import { enviarCampanhaSms } from '@/lib/smsCampanha'

export const maxDuration = 120

/** GET /api/cron/sms-agendados — roda a cada poucos minutos (ver vercel.json). Acha disparos SMS
 * com status 'agendado' cuja dataDisparo+horarioDisparo já chegou, dispara de verdade (mesma
 * lógica do envio imediato) e marca como 'executado'. Sem isso, "agendar" só cria o registro —
 * quem manda de fato é esse cron. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const agora = new Date()
  const todos = await listarDisparos({ status: 'agendado' })
  const agendadosSms = todos.filter((d) => d.canal === 'sms')

  const vencidos = agendadosSms.filter((d) => {
    if (!d.dataDisparo || !d.horarioDisparo) return false
    const alvo = new Date(`${d.dataDisparo}T${d.horarioDisparo}:00-03:00`)
    return alvo <= agora
  })

  // request.url NÃO é confiável aqui — invocações de Cron da Vercel não necessariamente batem no
  // domínio público (confirmado ao vivo: 1000 SMS reais de uma campanha agendada ficaram travados
  // em "queued" pra sempre porque o Solvefy recebeu um callbackUrl inalcançável). Mesmo padrão já
  // usado em lib/telegram/keyboards.ts e lib/testes/*.ts pro mesmo problema.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://controlenumeros.vercel.app'
  const callbackUrl = `${appUrl}/api/sms/webhook`

  const resultados = []
  for (const disparo of vencidos) {
    if (!disparo.smsDestinatarios?.length || !disparo.smsCorpo || !disparo.smsFrom) {
      await atualizarDisparo(disparo.id, { status: 'cancelado', notas: `${disparo.notas ?? ''}\n[cron] Cancelado: faltam dados de envio (corpo/from/destinatários).`.trim() })
      resultados.push({ id: disparo.id, ok: false, erro: 'dados de envio incompletos' })
      continue
    }
    try {
      const resultado = await enviarCampanhaSms({
        campanha: disparo.nomenclatura,
        from: disparo.smsFrom,
        corpo: disparo.smsCorpo,
        useShortener: disparo.smsUseShortener,
        destinatarios: disparo.smsDestinatarios,
        callbackUrl,
      })
      await atualizarDisparo(disparo.id, { status: 'executado' })
      resultados.push({ id: disparo.id, ok: true, enviados: resultado.enviados, falhas: resultado.falhas })
    } catch (err) {
      resultados.push({ id: disparo.id, ok: false, erro: (err as Error).message })
    }
  }

  return NextResponse.json({ ok: true, verificados: agendadosSms.length, disparados: vencidos.length, resultados })
}
