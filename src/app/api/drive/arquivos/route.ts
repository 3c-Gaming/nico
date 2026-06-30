import { NextRequest, NextResponse } from 'next/server'
import { listarArquivos, listarPastasFilhas } from '@/lib/integrações/googleDrive'

export async function GET(request: NextRequest) {
  const folderId = request.nextUrl.searchParams.get('folderId')
  if (!folderId) {
    return NextResponse.json({ error: 'folderId é obrigatório' }, { status: 400 })
  }

  try {
    const [arquivos, subpastas] = await Promise.all([
      listarArquivos(folderId),
      listarPastasFilhas(folderId),
    ])
    return NextResponse.json({ arquivos, subpastas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
