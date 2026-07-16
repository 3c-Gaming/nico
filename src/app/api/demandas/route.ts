import { NextResponse } from 'next/server'
import { listarDemandas, criarDemanda } from '@/lib/api-store'
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
  return NextResponse.json({ demanda })
}
