import { NextResponse } from 'next/server'
import type { DisparoPilhado } from '@/types'
import { parseCsvPilhado } from '@/lib/pilhadoPremiosCsv'
import { bulkInsertDisparosPilhado } from '@/lib/db/supabase'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file é obrigatório' }, { status: 400 })

    const csvTexto = await file.text()
    const linhas = parseCsvPilhado(csvTexto)
    if (!linhas.length) return NextResponse.json({ error: 'Nenhuma linha válida encontrada no CSV' }, { status: 400 })

    const agora = new Date().toISOString()
    const registros: DisparoPilhado[] = linhas.map((l) => ({
      id: crypto.randomUUID(),
      data: l.data,
      painel: l.painel,
      origem: 'manual',
      totalBase: l.totalBase,
      entregues: l.entregues,
      lidas: l.lidas,
      vendas: l.vendas,
      faturamento: l.faturamento,
      criadoEm: agora,
      atualizadoEm: agora,
    }))

    const inseridos = await bulkInsertDisparosPilhado(registros)
    return NextResponse.json({ disparos: inseridos, total: inseridos.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao processar CSV' }, { status: 500 })
  }
}
