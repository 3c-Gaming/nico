import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'
import { enviarCampanhaRcs } from '@/lib/rcs/campanha'
import { validarRcsContent } from '@/lib/rcs/template'
import type { RcsContent, DestinatarioRcs } from '@/lib/rcs/tipos'

interface EnviarBody {
  campanha: string
  /** Um dos dois: o content inline, ou o id de um template salvo. */
  conteudo?: RcsContent
  templateId?: string
  destinatarios: DestinatarioRcs[]
}

async function resolverConteudo(body: EnviarBody): Promise<RcsContent | null> {
  if (body.conteudo) return body.conteudo
  if (!body.templateId) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return null
  const { data } = await supabase.from('rcs_templates').select('conteudo').eq('id', body.templateId).single()
  return (data?.conteudo as RcsContent) ?? null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EnviarBody
    if (!body.campanha || !Array.isArray(body.destinatarios) || body.destinatarios.length === 0) {
      return NextResponse.json({ error: 'campanha e destinatarios são obrigatórios' }, { status: 400 })
    }

    const conteudo = await resolverConteudo(body)
    const erros = validarRcsContent(conteudo)
    if (erros.length) return NextResponse.json({ error: erros.join('; ') }, { status: 400 })

    const callbackUrl = `${request.nextUrl.origin}/api/rcs/webhook`

    const resultado = await enviarCampanhaRcs({
      campanha: body.campanha,
      conteudo: conteudo!,
      destinatarios: body.destinatarios,
      callbackUrl,
    })

    return NextResponse.json(resultado)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
