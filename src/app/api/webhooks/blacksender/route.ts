import { NextRequest, NextResponse } from 'next/server'
import { registrarWebhookEvento } from '@/lib/db/supabase'

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
