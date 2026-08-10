import { NextResponse } from 'next/server'
import { sincronizarPainel } from '@/lib/pilhadoPremiosSync'

// Login + trocar edição + ler os cards é bem mais rápido que a paginação de compras que isso
// substituiu, mas ainda folgado o bastante pra cobrir um login lento sem estourar o padrão da
// Vercel.
export const maxDuration = 120

export async function POST(request: Request) {
  const { painel } = await request.json()
  if (!painel) {
    return NextResponse.json({ error: 'Parâmetro obrigatório: painel' }, { status: 400 })
  }

  const resultado = await sincronizarPainel(painel)
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.erro ?? 'Erro ao sincronizar painel' }, { status: 502 })
  }
  return NextResponse.json(resultado)
}
