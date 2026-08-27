import { NextResponse } from 'next/server'
import { listarDisparos, atualizarDisparo } from '@/lib/api-store'
import { enviarCampanhaSms } from '@/lib/smsCampanha'
import { getSupabase } from '@/lib/db/supabase'
import type { Disparo } from '@/types'

// 500 por ciclo (a cada 5 min, ver vercel.json) — não dá pra mandar a base inteira de uma vez:
// além de bater no timeout da function, manda a reputação do remetente pro espaço. Uma base de
// 6001 agora sai em ~12 ciclos (~1h) em vez de tentar (e falhar) tudo em 2 minutos.
const TAMANHO_LOTE_CICLO = 500

// Timeout generoso mesmo processando só 500 por vez — dá margem pra latência de rede variar sem
// a Vercel matar a function no meio do lote.
export const maxDuration = 300

// Heartbeat de reivindicação: se ninguém atualizou o disparo há mais que isso, outra execução não
// está mais processando ele de verdade (crashou, timeout, o que for) — seguro retomar. Tem que
// ser bem menor que o intervalo do cron (5 min) pra não sobrepor duas execuções legítimas, mas
// grande o suficiente pra cobrir um lote de 500 rodando (segundos, não minutos).
const HEARTBEAT_STALE_MINUTOS = 3

/** Quantos destinatários dessa campanha já têm linha em sms_envios — é o "ponteiro" de progresso.
 * Não precisa de coluna nova: a própria tabela de envios já é a fonte da verdade de quem já foi
 * tentado. Combinado com o dedupe por `reference` da Solvefy (mesma campanha+telefone nunca vira
 * SMS duas vezes), retomar do meio é seguro mesmo se essa contagem ficar levemente desatualizada. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function contarJaEnviados(supabase: any, campanha: string): Promise<number> {
  const { count, error } = await supabase
    .from('sms_envios')
    .select('id', { count: 'exact', head: true })
    .eq('campanha', campanha)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Reivindica o disparo pra esse ciclo processar o próximo lote — atômico via UPDATE condicional,
 * cobrindo os dois casos possíveis:
 *   - 'agendado' -> 'enviando': primeiro lote da campanha.
 *   - 'enviando' com heartbeat velho -> continua: lote seguinte de uma campanha já em andamento.
 * Se o UPDATE não afetar nenhuma linha, outra execução já reivindicou (ou está processando de
 * verdade) esse disparo agora — a nossa pula.
 *
 * Isso substitui o lock simples de antes: aquele só resolvia o primeiro lote. Sem o caso
 * 'enviando' + heartbeat velho, uma campanha grande nunca sairia do primeiro lote — ela ficaria
 * 'enviando' pra sempre e nenhum ciclo futuro a pegaria de volta. */
async function reivindicarProximoLote(disparo: Disparo): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return true // sem DB configurado (dev local) — segue o fluxo antigo, sem lock

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

  // status === 'enviando': só continua se o heartbeat estiver velho o suficiente pra ter certeza
  // que ninguém mais está no meio de um lote agora.
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

/** Marca só o heartbeat (sem mudar status) — sinaliza "ainda processando, só terminei um lote e
 * vou continuar no próximo ciclo", sem soltar a reivindicação pra outra execução. */
async function marcarHeartbeat(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return
  const { error } = await supabase.from('disparos').update({ atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** GET /api/cron/sms-agendados — roda a cada poucos minutos (ver vercel.json). Acha disparos SMS
 * agendados cujo horário já chegou (ou já em andamento, esperando o próximo lote) e manda até
 * TAMANHO_LOTE_CICLO destinatários por vez, retomando de onde parou a cada ciclo até completar a
 * base inteira. Sem isso, "agendar" só cria o registro — quem manda de fato é esse cron. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const agora = new Date()

  const agendados = (await listarDisparos({ status: 'agendado' })).filter((d) => d.canal === 'sms')
  const vencidos = agendados.filter((d) => {
    if (!d.dataDisparo || !d.horarioDisparo) return false
    const alvo = new Date(`${d.dataDisparo}T${d.horarioDisparo}:00-03:00`)
    return alvo <= agora
  })

  // Já em andamento (lote anterior mandou parte da base, falta o resto) — não tem due-check
  // porque, por definição, já passou do horário há muito tempo.
  const emAndamento = (await listarDisparos({ status: 'enviando' })).filter((d) => d.canal === 'sms')

  const candidatos = [...vencidos, ...emAndamento]

  // request.url NÃO é confiável aqui — invocações de Cron da Vercel não necessariamente batem no
  // domínio público (confirmado ao vivo: 1000 SMS reais de uma campanha agendada ficaram travados
  // em "queued" pra sempre porque o Solvefy recebeu um callbackUrl inalcançável). Mesmo padrão já
  // usado em lib/telegram/keyboards.ts e lib/testes/*.ts pro mesmo problema.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://controlenumeros.vercel.app'
  const callbackUrl = `${appUrl}/api/sms/webhook`

  const resultados = []
  for (const disparo of candidatos) {
    if (!disparo.smsDestinatarios?.length || !disparo.smsCorpo || !disparo.smsFrom) {
      await atualizarDisparo(disparo.id, { status: 'cancelado', notas: `${disparo.notas ?? ''}\n[cron] Cancelado: faltam dados de envio (corpo/from/destinatários).`.trim() })
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
      const restantes = disparo.smsDestinatarios.slice(jaEnviados)
      const lote = restantes.slice(0, TAMANHO_LOTE_CICLO)

      if (lote.length === 0) {
        // Já tinha terminado tudo (ex: race entre dois heartbeats) — só fecha.
        await atualizarDisparo(disparo.id, { status: 'executado' })
        resultados.push({ id: disparo.id, ok: true, enviados: 0, falhas: 0, completo: true })
        continue
      }

      const resultado = await enviarCampanhaSms({
        campanha: disparo.nomenclatura,
        from: disparo.smsFrom,
        corpo: disparo.smsCorpo,
        useShortener: disparo.smsUseShortener,
        destinatarios: lote,
        callbackUrl,
      })

      const completo = jaEnviados + lote.length >= disparo.smsDestinatarios.length
      if (completo) {
        await atualizarDisparo(disparo.id, { status: 'executado' })
      } else {
        await marcarHeartbeat(disparo.id)
      }
      resultados.push({ id: disparo.id, ok: true, enviados: resultado.enviados, falhas: resultado.falhas, progresso: `${jaEnviados + lote.length}/${disparo.smsDestinatarios.length}`, completo })
    } catch (err) {
      // Devolve pra 'agendado' — progresso não se perde (a contagem em sms_envios continua valendo
      // pro próximo ciclo), e retomar mais rápido (próximo tick) é melhor que esperar o heartbeat
      // ficar velho.
      await atualizarDisparo(disparo.id, { status: 'agendado' })
      resultados.push({ id: disparo.id, ok: false, erro: (err as Error).message })
    }
  }

  return NextResponse.json({ ok: true, verificados: agendados.length, processados: candidatos.length, resultados })
}
