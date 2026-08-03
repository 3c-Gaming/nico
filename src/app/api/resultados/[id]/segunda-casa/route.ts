import { NextResponse } from 'next/server'
import { getResultado, atualizarResultado } from '@/lib/api-store'
import { processarCsvSegundaCasa } from '@/lib/resultados/segundaCasa'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resultado = await getResultado(id)
  if (!resultado) return NextResponse.json({ error: 'Resultado não encontrado' }, { status: 404 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file é obrigatório' }, { status: 400 })

    const csvTexto = await file.text()
    const segundaCasa = processarCsvSegundaCasa(csvTexto)

    const atualizado = await atualizarResultado(id, { dados: { ...resultado.dados, segundaCasa } })
    return NextResponse.json({ resultado: atualizado })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao processar CSV' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resultado = await getResultado(id)
  if (!resultado) return NextResponse.json({ error: 'Resultado não encontrado' }, { status: 404 })

  const atualizado = await atualizarResultado(id, { dados: { ...resultado.dados, segundaCasa: [] } })
  return NextResponse.json({ resultado: atualizado })
}
