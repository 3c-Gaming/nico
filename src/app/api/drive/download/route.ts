import { NextRequest, NextResponse } from 'next/server'
import { downloadArquivo } from '@/lib/integrações/googleDrive'

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId')
  if (!fileId) {
    return NextResponse.json({ error: 'fileId é obrigatório' }, { status: 400 })
  }

  try {
    const { buffer, nome } = await downloadArquivo(fileId)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${nome}"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
