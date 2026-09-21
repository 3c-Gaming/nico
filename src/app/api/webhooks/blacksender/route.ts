import { NextRequest, NextResponse } from 'next/server'
import { registrarWebhookEvento, upsertBlacksenderLead, upsertBlacksenderFlowRun, upsertBlacksenderConversa, upsertBlacksenderMensagem, upsertBlacksenderFlow, upsertBlacksenderCanal, getBlacksenderLead } from '@/lib/db/supabase'
import { notificarNovoLead, notificarTagsAplicadas } from '@/lib/discord/notify-blacksender'
import type { BlacksenderLead } from '@/types'

// Webhook público que o Black Sender (CRM receptivo de WhatsApp) chama pros eventos configurados
// no painel dele: Leads criados, Conversas, Kanban, Tags, Erros. Não temos a doc do payload
// ainda — cada evento é gravado cru (JSON + headers) em webhook_eventos_recebidos pra
// inspecionar o formato real assim que os eventos de teste forem forçados, antes de mapear pra
// dado estruturado (mesmo princípio do webhook de SMS da Solvefy, também não documentado).
//
// Sem verificação de assinatura/segredo — Black Sender não documentou nenhum mecanismo de auth
// pro callback até onde sabemos. Se expuserem um header de assinatura, validar aqui.
//
// Uma URL por tipo de evento no painel do Black Sender — usar o mesmo endpoint com
// ?evento=<nome> em cada campo (leads_criados, conversas, kanban, tags, erros), já que o
// payload em si pode não indicar o tipo.
//
// Além disso recebe `leads_realtime`/`flow_runs_realtime` do blacksender-bridge (serviço
// standalone que assina Realtime no Supabase do Black Sender e encaminha pra cá — ver
// blacksender-bridge/src/realtimeListener.ts). Esses dois eventos têm formato conhecido e são
// estruturados em blacksender_leads / blacksender_flow_runs além do log cru.

function extrairEvento(request: NextRequest, body: unknown): string {
  const daQuery = request.nextUrl.searchParams.get('evento')
  if (daQuery) return daQuery
  const alvo = body as Record<string, unknown> | null
  const doBody = alvo?.event ?? alvo?.type ?? alvo?.evento ?? alvo?.tipo
  return typeof doBody === 'string' && doBody ? doBody : 'desconhecido'
}

// A infra da própria Vercel injeta headers internos (token OIDC do projeto, assinatura de proxy
// interna, etc.) em toda request — não vêm do Black Sender e não devem ficar guardados no banco.
const HEADER_IGNORADO = /^(x-vercel-oidc-token|x-vercel-sc-headers|x-vercel-proxy-signature.*|forwarded|authorization|cookie)$/i

// Eventos que o blacksender-bridge encaminha a partir da assinatura Realtime no Supabase do
// Black Sender (ver blacksender-bridge/src/realtimeListener.ts) — já vêm com o nome de campo
// original deles, então o mapeamento aqui é melhor-esforço: campo que não bate com nada
// esperado ainda está preservado inteiro em `bruto`.
async function estruturar(evento: string, body: unknown) {
  const alvo = body as { tabela?: string; operacao?: string; registro?: Record<string, unknown> } | null
  const registro = alvo?.registro
  if (!registro || alvo?.operacao === 'DELETE') return

  const recebidoEm = new Date().toISOString()

  if (evento === 'leads_realtime' && alvo?.tabela === 'contacts') {
    const id = String(registro.id)
    // Compara com o que JÁ está salvo aqui (não com registroAnterior/old_record do Realtime —
    // esse costuma vir incompleto quando a tabela de origem não tem REPLICA IDENTITY FULL, e não
    // controlamos o schema da Black Sender pra garantir isso). Sem linha anterior = lead novo de
    // verdade; com linha anterior, compara os arrays de tag pra achar só as que entraram agora.
    const existente = await getBlacksenderLead(id)
    const tagsAntigas = new Set(Array.isArray(existente?.tags) ? (existente.tags as string[]) : [])
    const tagsNovasRegistro = Array.isArray(registro.tags) ? (registro.tags as string[]) : []
    const tagsNovas = tagsNovasRegistro.filter((t) => !tagsAntigas.has(t))

    const lead: BlacksenderLead = {
      id,
      nome: (registro.name as string) ?? null,
      telefone: (registro.phone as string) ?? null,
      tags: registro.tags ?? null,
      etapaId: (registro.stage_id as string) ?? null,
      aiDisabled: (registro.ai_disabled as boolean) ?? null,
      criadoEmOrigem: (registro.created_at as string) ?? null,
      recebidoEm,
      bruto: registro,
    }
    await upsertBlacksenderLead(lead)

    if (!existente) await notificarNovoLead(lead)
    else if (tagsNovas.length > 0) await notificarTagsAplicadas(lead, tagsNovas)
    return
  }

  if (evento === 'flow_runs_realtime' && alvo?.tabela === 'flow_runs') {
    await upsertBlacksenderFlowRun({
      id: String(registro.id),
      flowId: (registro.flow_id as string) ?? null,
      contactId: (registro.contact_id as string) ?? null,
      status: (registro.status as string) ?? null,
      criadoEmOrigem: (registro.started_at as string) ?? null,
      atualizadoEmOrigem: (registro.updated_at as string) ?? null,
      recebidoEm,
      bruto: registro,
    })
    return
  }

  if (evento === 'conversas_realtime' && alvo?.tabela === 'conversations') {
    await upsertBlacksenderConversa({
      id: String(registro.id),
      contactId: (registro.contact_id as string) ?? null,
      channelId: (registro.channel_id as string) ?? null,
      status: (registro.status as string) ?? null,
      ultimaMensagemEmOrigem: (registro.last_message_at as string) ?? null,
      criadoEmOrigem: (registro.created_at as string) ?? null,
      recebidoEm,
      bruto: registro,
    })
    return
  }

  if (evento === 'mensagens_realtime' && alvo?.tabela === 'messages') {
    await upsertBlacksenderMensagem({
      id: String(registro.id),
      conversationId: (registro.conversation_id as string) ?? null,
      conteudo: (registro.content as string) ?? null,
      direcao: (registro.direction as string) ?? null,
      remetente: (registro.sender_name as string) ?? null,
      status: (registro.status as string) ?? null,
      erroCodigo: (registro.delivery_error_code as string) ?? null,
      erroMensagem: (registro.delivery_error_message as string) ?? null,
      midiaUrl: (registro.media_url as string) ?? null,
      midiaTipo: (registro.media_type as string) ?? null,
      criadoEmOrigem: (registro.created_at as string) ?? null,
      recebidoEm,
      bruto: registro,
    })
    return
  }

  if (evento === 'flows_realtime' && alvo?.tabela === 'flows') {
    await upsertBlacksenderFlow({
      id: String(registro.id),
      nome: (registro.name as string) ?? null,
      ativo: (registro.is_active as boolean) ?? null,
      criadoEmOrigem: (registro.created_at as string) ?? null,
      recebidoEm,
      bruto: registro,
    })
    return
  }

  // `registro` aqui já vem sem access_token/meta_app_secret — o bridge nunca seleciona essas
  // colunas na origem (ver blacksender-bridge/src/poller.ts, CANAIS_COLUNAS). `bruto` abaixo é
  // seguro de guardar.
  if (evento === 'canais_realtime' && alvo?.tabela === 'whatsapp_channels') {
    await upsertBlacksenderCanal({
      id: String(registro.id),
      nome: (registro.channel_name as string) ?? null,
      telefone: (registro.business_phone_number as string) ?? null,
      provedor: (registro.provider as string) ?? null,
      status: (registro.status as string) ?? null,
      healthStatus: (registro.health_status as string) ?? null,
      healthReason: (registro.health_reason as string) ?? null,
      healthCheckedEm: (registro.health_checked_at as string) ?? null,
      metaPhoneStatus: (registro.meta_phone_status as string) ?? null,
      metaNameStatus: (registro.meta_name_status as string) ?? null,
      qualityRating: (registro.meta_quality_rating as string) ?? null,
      fotoUrl: (registro.profile_picture_url as string) ?? null,
      criadoEmOrigem: (registro.created_at as string) ?? null,
      recebidoEm,
      bruto: registro,
    })
  }
}

async function registrar(request: NextRequest) {
  const textoBruto = await request.text().catch(() => '')
  const body = textoBruto ? JSON.parse(textoBruto.trim() || 'null') : null

  const headers: Record<string, string> = {}
  request.headers.forEach((valor, chave) => {
    if (!HEADER_IGNORADO.test(chave)) headers[chave] = valor
  })

  const evento = extrairEvento(request, body)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  await registrarWebhookEvento({
    id: crypto.randomUUID(),
    origem: 'blacksender',
    evento,
    payload: body,
    headers,
    metodo: request.method,
    ip,
    recebidoEm: new Date().toISOString(),
  })

  await estruturar(evento, body)

  return evento
}

export async function POST(request: NextRequest) {
  try {
    const evento = await registrar(request)
    console.log(`[webhook/blacksender] evento recebido: ${evento}`)
  } catch (err) {
    // Payload não é JSON válido ou outro erro inesperado — loga mas não falha o webhook, senão
    // o Black Sender fica tentando de novo pra sempre por um payload que talvez nunca vamos
    // conseguir processar.
    console.error('[webhook/blacksender] erro ao registrar evento:', err)
  }
  return NextResponse.json({ ok: true })
}

// Alguns painéis de webhook fazem uma checagem de alcançabilidade (GET) antes de habilitar o
// toggle "Salvar" — responde 200 pra não travar essa validação.
export async function GET() {
  return NextResponse.json({ ok: true })
}
