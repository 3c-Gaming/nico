import { NextResponse } from 'next/server'
import { listarResultados, criarResultado } from '@/lib/api-store'
import { processarCsvResultados } from '@/lib/resultados/processarCsv'
import type { Resultado } from '@/types'

export async function GET() {
  const resultados = await listarResultados()
  return NextResponse.json({ resultados })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const titulo = formData.get('titulo') as string | null
    const periodoInicio = formData.get('periodoInicio') as string | null
    const periodoFim = formData.get('periodoFim') as string | null

    if (!file || !titulo || !periodoInicio || !periodoFim) {
      return NextResponse.json({ error: 'file, titulo, periodoInicio e periodoFim são obrigatórios' }, { status: 400 })
    }

    const csvTexto = await file.text()
    const dados = processarCsvResultados(csvTexto, { inicio: periodoInicio, fim: periodoFim })

    const agora = new Date().toISOString()
    const resultado: Resultado = {
      id: crypto.randomUUID(),
      titulo,
      periodoInicio,
      periodoFim,
      dados,
      topicos: { acertos: [], pontosAtencao: [], proximosPassos: [] },
      publicToken: null,
      criadoEm: agora,
      atualizadoEm: agora,
    }

    const criado = await criarResultado(resultado)
    return NextResponse.json({ resultado: criado })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao processar CSV' }, { status: 500 })
  }
}
