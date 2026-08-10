import { NextResponse } from 'next/server'
import { sincronizarPainelDesde } from '@/lib/pilhadoPremiosSync'

// Mesmo motivo do maxDuration na rota de sincronizar por id — scrape de um mês inteiro passa do
// timeout padrão da Vercel.
export const maxDuration = 280

export async function POST(request: Request) {
  const { painel, desde } = await request.json()
  if (!painel || !desde) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios: painel, desde' }, { status: 400 })
  }

  const resultado = await sincronizarPainelDesde(painel, desde)
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.erro ?? 'Erro ao sincronizar painel' }, { status: 502 })
  }
  return NextResponse.json(resultado)
}
