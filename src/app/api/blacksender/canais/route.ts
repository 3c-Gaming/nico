import { NextResponse } from 'next/server'
import { listarBlacksenderCanais, buscarUltimaMensagemEnviadaPorCanal } from '@/lib/db/supabase'

export async function GET() {
  const canais = await listarBlacksenderCanais()
  const comAtividade = await Promise.all(
    canais.map(async (canal) => ({
      ...canal,
      ultimaMensagemEnviada: await buscarUltimaMensagemEnviadaPorCanal(canal.id),
    })),
  )
  return NextResponse.json({ canais: comAtividade })
}
