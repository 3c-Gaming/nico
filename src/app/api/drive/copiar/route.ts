import { NextRequest, NextResponse } from 'next/server'
import { copiarArquivo } from '@/lib/integrações/googleDrive'

export async function POST(request: NextRequest) {
  try {
    const { fileId, pastaDestinoId, nome } = await request.json()
    if (!fileId || !pastaDestinoId) {
      return NextResponse.json({ error: 'fileId e pastaDestinoId são obrigatórios' }, { status: 400 })
    }
    const arquivo = await copiarArquivo(fileId, pastaDestinoId, nome)
    return NextResponse.json({ arquivo })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
