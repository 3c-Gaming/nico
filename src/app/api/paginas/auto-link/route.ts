import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) return NextResponse.json({ error: 'Supabase indisponível' }, { status: 500 })

    // Buscar todas as tabelas necessárias
    const [paginasRes, casasRes, flowsRes] = await Promise.all([
      sb.from('paginas').select('id, nome, lovable_project_id, lovable_name, funil, casa_id'),
      sb.from('casas_aposta').select('id, nome, funil_ids'),
      sb.from('flow_tag_configs').select('funil, casas, lp_url'),
    ])

    const paginas = (paginasRes.data ?? []) as any[]
    const casas = (casasRes.data ?? []) as any[]
    const flows = (flowsRes.data ?? []) as any[]

    // Mapa: funil -> casa_id (via casas_aposta.funil_ids)
    const funilToCasa = new Map<string, string>()
    for (const casa of casas) {
      const ids = casa.funil_ids ?? []
      for (const f of ids) {
        funilToCasa.set(f, casa.id)
      }
    }

    // Mapa: lovable_name ou URL -> funil (via flow_tag_configs.lp_url)
    const urlToFunil = new Map<string, string>()
    for (const flow of flows) {
      if (flow.lp_url && flow.funil) {
        urlToFunil.set(flow.lp_url, flow.funil)
        // Também extrair o slug do lovable da URL
        const match = flow.lp_url.match(/https?:\/\/([^.]+)\.lovable\.app/)
        if (match) {
          urlToFunil.set(match[1], flow.funil)
        }
      }
    }

    let updated = 0
    const results: Array<{ nome: string; funil?: string; casa?: string }> = []

    for (const pagina of paginas) {
      let funil = pagina.funil
      let casaId = pagina.casa_id

      // Tentar detectar funil pelo nome da página (ex: "F26.02" no nome)
      if (!funil) {
        const match = pagina.nome.match(/F\d+(?:[._-]\d+)?/i)
        if (match) {
          const candidato = match[0].toUpperCase().replace('_', '.').replace('-', '.')
          // Verificar se existe no mapa
          if (funilToCasa.has(candidato)) {
            funil = candidato
          }
        }
      }

      // Tentar detectar funil pelo lovable_name
      if (!funil && pagina.lovable_name) {
        const f = urlToFunil.get(pagina.lovable_name)
        if (f) funil = f
      }

      // Inferir casa pelo funil
      if (funil && !casaId) {
        casaId = funilToCasa.get(funil) ?? null
      }

      // Se mudou algo, atualizar
      if ((funil && funil !== pagina.funil) || (casaId && casaId !== pagina.casa_id)) {
        const updates: any = {}
        if (funil && funil !== pagina.funil) updates.funil = funil
        if (casaId && casaId !== pagina.casa_id) updates.casa_id = casaId

        await (sb.from('paginas') as any).update(updates).eq('id', pagina.id)
        updated++

        const casaNome = casas.find((c: any) => c.id === casaId)?.nome
        results.push({ nome: pagina.nome, funil, casa: casaNome })
      }
    }

    return NextResponse.json({ ok: true, updated, results })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
