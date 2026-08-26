import { NextRequest, NextResponse } from 'next/server'

const GRAPHQL_URL = process.env.SWITCHY_API_URL
const API_KEY = process.env.SWITCHY_API_KEY

/** GET /api/switchy/clicks?url=https://swiy.co/slug — clicks agregados de um link do Switchy
 * (contador único por link, não por destinatário — a Switchy não sabe quem clicou, só quantos
 * cliques o link recebeu no total). Usa o endpoint GraphQL da Switchy (Api-Authorization, não
 * "Bearer" — confirmado na doc oficial), chave composta (id do slug + domínio).
 *
 * IMPORTANTE: `clicks` é um contador VITALÍCIO do link, não filtrável por data — confirmado via
 * introspecção completa do schema (só existe esse contador direto na tabela, sem tabela de
 * eventos com timestamp por trás). Se o link for reaproveitado entre campanhas, esse número
 * mistura cliques de todas elas. Devolve `createdDate` junto pra UI conseguir avisar quando o
 * link é mais antigo que a campanha (número não é específico dela). */
export async function GET(request: NextRequest) {
  if (!GRAPHQL_URL || !API_KEY) {
    return NextResponse.json({ error: 'Switchy não configurado (SWITCHY_API_URL/SWITCHY_API_KEY)' }, { status: 500 })
  }

  const urlParam = request.nextUrl.searchParams.get('url')
  if (!urlParam) return NextResponse.json({ error: '"url" é obrigatório' }, { status: 400 })

  let domain: string
  let id: string
  try {
    const parsed = new URL(urlParam)
    domain = parsed.hostname
    id = parsed.pathname.replace(/^\//, '').replace(/\/$/, '')
  } catch {
    return NextResponse.json({ error: 'url inválida' }, { status: 400 })
  }
  if (!id) return NextResponse.json({ error: 'url sem slug' }, { status: 400 })

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Authorization': API_KEY },
      body: JSON.stringify({
        query: 'query($id: String!, $domain: String!) { links_by_pk(id: $id, domain: $domain) { clicks createdDate } }',
        variables: { id, domain },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Switchy HTTP ${res.status}: ${text}` }, { status: 502 })
    }
    const json = await res.json()
    if (json.errors) return NextResponse.json({ error: json.errors[0]?.message ?? 'erro na consulta Switchy' }, { status: 502 })
    const clicks = json.data?.links_by_pk?.clicks
    if (clicks === undefined || clicks === null) return NextResponse.json({ clicks: null, encontrado: false })
    return NextResponse.json({ clicks, criadoEm: json.data?.links_by_pk?.createdDate ?? null, encontrado: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
