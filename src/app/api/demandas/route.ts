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
  console.log('[demandas/POST] body recebido:', { titulo: body.titulo, responsavelId: body.responsavelId, coluna: body.coluna })

  const demanda = await criarDemanda({
    ...body,
    tags: body.tags ?? [],
    userStories: body.userStories ?? [],
    links: body.links ?? [],
    imagens: body.imagens ?? [],
    funilIds: body.funilIds ?? [],
    numerosSendpulse: body.numerosSendpulse ?? [],
  })
  console.log('[demandas/POST] demanda criada:', { id: demanda.id, titulo: demanda.titulo, responsavelId: demanda.responsavelId })

  const channelId = process.env.DISCORD_REPORT_CHANNEL_ID
  const botToken = process.env.DISCORD_BOT_TOKEN
  console.log('[demandas/POST] env vars discord:', {
    DISCORD_REPORT_CHANNEL_ID: channelId ? `${channelId.slice(0, 8)}...` : 'undefined',
    DISCORD_BOT_TOKEN: botToken ? `${botToken.slice(0, 8)}...` : 'undefined',
  })

  const usuarios = await listarUsuariosResponsaveis()
  console.log('[demandas/POST] usuarios carregados:', usuarios.length)

  const responsavel = demanda.responsavelId ? usuarios.find((u) => u.id === demanda.responsavelId) : undefined
  console.log('[demandas/POST] responsavel encontrado:', responsavel ? `${responsavel.nome} (discordId: ${responsavel.discordId ?? 'nenhum'})` : 'nenhum')

  try {
    await notificarCriacao(demanda, responsavel)
    console.log('[demandas/POST] notificacao discord enviada com sucesso')
  } catch (err) {
    console.error('[demandas/POST] erro ao notificar discord:', (err as Error).message)
  }

  return NextResponse.json({ demanda })
}
