import { NextResponse } from 'next/server'
import { listarDemandas, criarDemanda, listarUsuariosResponsaveis } from '@/lib/api-store'
import { notificarCriacao } from '@/lib/discord/notify-demandas'
import type { Demanda } from '@/types'

export async function GET() {
  const demandas = await listarDemandas()
  return NextResponse.json({ demandas })
}

export async function POST(req: Request) {
  const body: Demanda = await req.json()
  const demanda = await criarDemanda({
    ...body,
    tags: body.tags ?? [],
    userStories: body.userStories ?? [],
    links: body.links ?? [],
    imagens: body.imagens ?? [],
    funilIds: body.funilIds ?? [],
    numerosSendpulse: body.numerosSendpulse ?? [],
  })

  const usuarios = await listarUsuariosResponsaveis()
  const responsavel = demanda.responsavelId ? usuarios.find((u) => u.id === demanda.responsavelId) : undefined
  notificarCriacao(demanda, responsavel).catch(() => {})

  return NextResponse.json({ demanda })
}
