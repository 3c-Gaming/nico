import { NextResponse } from 'next/server'
import { listarDisparos, atualizarDisparo } from '@/lib/api-store'
import { enviarCampanhaRcs } from '@/lib/rcs/campanha'
import { getSupabase } from '@/lib/db/supabase'
import type { Disparo } from '@/types'

// Mesmo molde de /api/cron/sms-agendados: lotes retomáveis, reivindicação atômica por transição
// de status + heartbeat. Ver os comentários de lá pro raciocínio completo.
const TAMANHO_LOTE_CICLO = 500
export const maxDuration = 300
const HEARTBEAT_STALE_MINUTOS = 3

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function contarJaEnviados(supabase: any, campanha: string): Promise<number> {
  const { count, error } = await supabase
    .from('rcs_envios')
    .select('id', { count: 'exact', head: true })
    .eq('campanha', campanha)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function reivindicarProximoLote(disparo: Disparo): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return true

  if (disparo.status === 'agendado') {
    const { data, error } = await supabase
      .from('disparos')
      .update({ status: 'enviando' })
      .eq('id', disparo.id)
      .eq('status', 'agendado')
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
  }

  const corte = new Date(Date.now() - HEARTBEAT_STALE_MINUTOS * 60_000).toISOString()
  const { data, error } = await supabase
    .from('disparos')
    .update({ atualizado_em: new Date().toISOString() })
    .eq('id', disparo.id)
    .eq('status', 'enviando')
    .lt('atualizado_em', corte)
    .select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

async function marcarHeartbeat(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return
  const { error } = await supabase.from('disparos').update({ atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** GET /api/cron/rcs-agendados — acha disparos RCS agendados cujo horário chegou (ou já em
 * andamento) e manda até TAMANHO_LOTE_CICLO por ciclo, retomando de onde parou. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const agora = new Date()

  const agendados = (await listarDisparos({ status: 'agendado' })).filter((d) => d.canal === 'rcs')
  const vencidos = agendados.filter((d) => {
    if (!d.dataDisparo || !d.horarioDisparo) return false
    const alvo = new Date(`${d.dataDisparo}T${d.horarioDisparo}:00-03:00`)
    return alvo <= agora
  })
  const emAndamento = (await listarDisparos({ status: 'enviando' })).filter((d) => d.canal === 'rcs')
  const candidatos = [...vencidos, ...emAndamento]

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://controlenumeros.vercel.app'
  const callbackUrl = `${appUrl}/api/rcs/webhook`

  const resultados = []
  for (const disparo of candidatos) {
    if (!disparo.rcsDestinatarios?.length || !disparo.rcsConteudo) {
      await atualizarDisparo(disparo.id, {
        status: 'cancelado',
        notas: `${disparo.notas ?? ''}\n[cron] Cancelado: faltam dados de envio (conteúdo/destinatários).`.trim(),
      })
      resultados.push({ id: disparo.id, ok: false, erro: 'dados de envio incompletos' })
      continue
    }

    let reivindicado: boolean
    try {
      reivindicado = await reivindicarProximoLote(disparo)
    } catch (err) {
      resultados.push({ id: disparo.id, ok: false, erro: `falha ao reivindicar: ${(err as Error).message}` })
      continue
    }
    if (!reivindicado) {
      resultados.push({ id: disparo.id, ok: false, erro: 'já sendo processado por outra execução do cron' })
      continue
    }

    try {
      const supabase = getSupabase()
      const jaEnviados = supabase ? await contarJaEnviados(supabase, disparo.nomenclatura) : 0
      const restantes = disparo.rcsDestinatarios.slice(jaEnviados)
      const lote = restantes.slice(0, TAMANHO_LOTE_CICLO)

      if (lote.length === 0) {
        await atualizarDisparo(disparo.id, { status: 'executado' })
        resultados.push({ id: disparo.id, ok: true, enviados: 0, falhas: 0, completo: true })
        continue
      }

      const resultado = await enviarCampanhaRcs({
        campanha: disparo.nomenclatura,
        conteudo: disparo.rcsConteudo,
        destinatarios: lote,
        callbackUrl,
      })

      const completo = jaEnviados + lote.length >= disparo.rcsDestinatarios.length
      if (completo) {
        await atualizarDisparo(disparo.id, { status: 'executado' })
      } else {
        await marcarHeartbeat(disparo.id)
      }
      resultados.push({
        id: disparo.id,
        ok: true,
        enviados: resultado.enviados,
        falhas: resultado.falhas,
        progresso: `${jaEnviados + lote.length}/${disparo.rcsDestinatarios.length}`,
        completo,
      })
    } catch (err) {
      await atualizarDisparo(disparo.id, { status: 'agendado' })
      resultados.push({ id: disparo.id, ok: false, erro: (err as Error).message })
    }
  }

  return NextResponse.json({ ok: true, verificados: agendados.length, processados: candidatos.length, resultados })
}
