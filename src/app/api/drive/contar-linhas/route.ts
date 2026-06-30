import { NextRequest, NextResponse } from 'next/server'
import { downloadArquivo } from '@/lib/integrações/googleDrive'

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId')
  if (!fileId) {
    return NextResponse.json({ error: 'fileId é obrigatório' }, { status: 400 })
  }

  try {
    const { buffer } = await downloadArquivo(fileId)
    const texto = new TextDecoder().decode(buffer)
    const linhas = texto.split('\n').filter((l) => l.trim().length > 0)
    // Primeira linha é cabeçalho
    const totalLinhas = Math.max(0, linhas.length - 1)
    return NextResponse.json({ totalLinhas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
