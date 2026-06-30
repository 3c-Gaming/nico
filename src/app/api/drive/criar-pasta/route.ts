import { NextRequest, NextResponse } from 'next/server'
import { criarPasta, obterPastaPorNome } from '@/lib/integrações/googleDrive'

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!
const SUBPASTAS = ['D1', 'D3', 'D5', 'D7']

export async function POST(request: NextRequest) {
  try {
    const { nome } = await request.json()
    if (!nome || !/^\d{4}$/.test(nome)) {
      return NextResponse.json({ error: 'nome deve estar no formato DDMM' }, { status: 400 })
    }

    const existente = await obterPastaPorNome(nome)
    if (existente) {
      return NextResponse.json({ pasta: existente, aviso: 'Pasta já existe' })
    }

    const pasta = await criarPasta(nome, ROOT_FOLDER_ID)

    for (const sub of SUBPASTAS) {
      await criarPasta(sub, pasta.id)
    }

    return NextResponse.json({ pasta })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
