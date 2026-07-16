import { NextResponse } from 'next/server'
import { listarUsuariosResponsaveis, criarUsuarioResponsavel } from '@/lib/api-store'
import type { UsuarioResponsavel } from '@/types'

export async function GET() {
  const usuarios = await listarUsuariosResponsaveis()
  return NextResponse.json({ usuarios })
}

export async function POST(req: Request) {
  const body: UsuarioResponsavel = await req.json()
  const usuario = await criarUsuarioResponsavel(body)
  return NextResponse.json({ usuario })
}
