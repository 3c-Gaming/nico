import { NextResponse } from 'next/server'
import { listarBlacksenderConversasPorContato, listarBlacksenderMensagens } from '@/lib/db/supabase'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conversas = await listarBlacksenderConversasPorContato(id)
  if (conversas.length === 0) return NextResponse.json({ error: 'Nenhuma conversa encontrada pra esse lead' }, { status: 404 })

  // Um contato pode ter mais de uma conversa (ex.: canais diferentes) — a mais recente primeiro
  // (listarBlacksenderConversasPorContato já ordena assim), mensagens de todas juntas em ordem
  // cronológica.
  const mensagensPorConversa = await Promise.all(conversas.map((c) => listarBlacksenderMensagens(c.id)))
  const mensagens = mensagensPorConversa.flat().sort((a, b) => (a.criadoEmOrigem ?? '').localeCompare(b.criadoEmOrigem ?? ''))

  return NextResponse.json({ conversas, mensagens })
}
