import { NextRequest, NextResponse } from 'next/server'
import { criarPasta, obterPastaPorNome } from '@/lib/integrações/googleDrive'

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!

export async function POST(request: NextRequest) {
  try {
    const { nome, parentId } = await request.json()
    if (!nome) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })
    }
    const pastaPai = parentId || ROOT_FOLDER_ID

    const existente = await obterPastaPorNome(nome, pastaPai)
    if (existente) {
      return NextResponse.json({ pasta: existente, aviso: 'Pasta já existe' })
    }

    const pasta = await criarPasta(nome, pastaPai)
    return NextResponse.json({ pasta })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
