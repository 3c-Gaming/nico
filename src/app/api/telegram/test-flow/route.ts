import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { getSupabase } = await import('@/lib/db/supabase')
    const sb = getSupabase()
    if (!sb) return NextResponse.json({ error: 'no supabase' })

    // Simular exatamente o que handleListarCasas faz
    const [{ data: paginasData, error: pErr }, { data: casasData, error: cErr }] = await Promise.all([
      sb.from('paginas').select('*').order('nome'),
      sb.from('casas_aposta').select('id, nome, cor').order('nome'),
    ])

    if (pErr || cErr) return NextResponse.json({ pErr, cErr })

    const paginas = (paginasData ?? []) as any[]
    const casas = (casasData ?? []) as any[]

    // Contar páginas por casa (exatamente como handleListarCasas)
    const contagens: Record<string, number> = {}
    for (const p of paginas) {
      if (p.casa_id) {
        contagens[p.casa_id] = (contagens[p.casa_id] ?? 0) + 1
      }
    }

    // Simular o que listaCasasFiltro geraria
    const buttons = casas
      .filter(c => (contagens[c.id] ?? 0) > 0)
      .map(c => ({ label: `🏠 ${c.nome} (${contagens[c.id]})`, callback: `pg:lc:${c.id}` }))

    // Simular pg:lc para a primeira casa que tem páginas
    const firstCasaId = Object.keys(contagens)[0]
    const filtradas = paginas.filter(p => p.casa_id === firstCasaId)
    const firstCasaNome = casas.find(c => c.id === firstCasaId)?.nome

    return NextResponse.json({
      totalPaginas: paginas.length,
      totalCasas: casas.length,
      contagens,
      buttons,
      testFilter: {
        casaId: firstCasaId,
        casaNome: firstCasaNome,
        filtradasCount: filtradas.length,
        filtradas: filtradas.map(p => p.nome),
      }
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, stack: (err as Error).stack })
  }
}
