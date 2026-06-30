import { NextRequest, NextResponse } from 'next/server'
import { downloadArquivo } from '@/lib/integrações/googleDrive'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 5 * 60_000

interface BackfillItem {
  id: string
  driveFileId: string
}

async function contarLinhas(driveFileId: string): Promise<number> {
  const { buffer } = await downloadArquivo(driveFileId)
  const texto = new TextDecoder().decode(buffer)
  const linhas = texto.split('\n').filter((l) => l.trim().length > 0)
  return Math.max(0, linhas.length - 1)
}

export async function POST(request: NextRequest) {
  try {
    const { disparos } = (await request.json()) as { disparos: BackfillItem[] }
    if (!disparos?.length) {
      return NextResponse.json({ error: 'Nenhum disparo enviado' }, { status: 400 })
    }

    const resultados: { id: string; totalLinhas: number }[] = []

    await Promise.all(
      disparos.map(async ({ id, driveFileId }) => {
        try {
          const totalLinhas = await getOrFetch('backfill', driveFileId, TTL_MS, () =>
            contarLinhas(driveFileId)
          )
          resultados.push({ id, totalLinhas })
        } catch {
          // falha silenciosa — disparo segue sem totalRegistros
        }
      })
    )

    return NextResponse.json({ resultados })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
