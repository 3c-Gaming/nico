import { NextRequest, NextResponse } from 'next/server'
import { uploadArquivo } from '@/lib/integrações/googleDrive'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const pastaId = formData.get('pastaId') as string | null
    const arquivo = formData.get('arquivo') as File | null

    if (!pastaId) {
      return NextResponse.json({ error: 'pastaId é obrigatório' }, { status: 400 })
    }
    if (!arquivo) {
      return NextResponse.json({ error: 'arquivo é obrigatório' }, { status: 400 })
    }

    const buffer = await arquivo.arrayBuffer()
    const criado = await uploadArquivo(arquivo.name, arquivo.type || 'text/csv', buffer, pastaId)

    return NextResponse.json({ arquivo: criado })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
