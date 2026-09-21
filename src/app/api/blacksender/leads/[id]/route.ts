import { NextResponse } from 'next/server'
import { getBlacksenderLead, listarBlacksenderFlowRunsPorContato } from '@/lib/db/supabase'

// Campos de `flow_runs.variables` que já aparecem em outro lugar da resposta (dado do lead em
// si, controle interno do fluxo) — o que sobra depois de tirar esses é o "Campos
// personalizados" que o painel do Black Sender mostra no detalhe do lead (url_fbc, url_fbp,
// url_fbclid, url_lead_id, etc.), incluindo variáveis futuras que a gente ainda não conhece.
const CAMPOS_INTERNOS = new Set([
  'nome', 'telefone', 'tags', 'tag', 'email', 'etapa', 'stage_id', 'responsavel',
  'assigned_user_id', 'last_message', 'last_button_id', 'last_button_handle',
  'last_media_url', 'last_media_type', 'media_valid',
])

function extrairVariaveisExternas(variables: unknown): Record<string, unknown> {
  if (!variables || typeof variables !== 'object') return {}
  const externas: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(variables as Record<string, unknown>)) {
    if (CAMPOS_INTERNOS.has(chave)) continue
    if (chave.startsWith('__') || chave.startsWith('http_status_')) continue
    externas[chave] = valor
  }
  return externas
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await getBlacksenderLead(id)
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  const fluxos = await listarBlacksenderFlowRunsPorContato(id)
  const bruto = fluxos[0]?.bruto as { variables?: unknown } | undefined
  const variaveisExternas = extrairVariaveisExternas(bruto?.variables)

  return NextResponse.json({ lead, fluxos, variaveisExternas })
}
