import { NextResponse } from 'next/server'
import { buscarUltimaMensagemEnviadaPorCanal, listarBlacksenderCanais, listarResumosNumerosBlacksender } from '@/lib/db/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [canais, resumos] = await Promise.all([
    listarBlacksenderCanais(),
    listarResumosNumerosBlacksender(),
  ])
  const comAtividade = await Promise.all(
    canais.map(async (canal) => ({
      ...canal,
      ...(resumos[canal.id] ?? {
        leadsHoje: 0,
        leadsPorDia: [],
        primeiroLeadEm: null,
        ultimoLeadEm: null,
        funis: 0,
      }),
      ultimaMensagemEnviada: await buscarUltimaMensagemEnviadaPorCanal(canal.id),
    })),
  )
  return NextResponse.json(
    { canais: comAtividade },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
