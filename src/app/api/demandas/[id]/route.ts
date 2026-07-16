import { NextResponse } from 'next/server'
import { getDemanda, atualizarDemanda, deletarDemanda, listarUsuariosResponsaveis } from '@/lib/api-store'
import { notificarMovimento, notificarEdicaoDescricao, notificarFinalizacao, notificarExclusao } from '@/lib/discord/notify-demandas'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const demanda = await getDemanda(id)
  if (!demanda) return NextResponse.json({ error: 'Demanda não encontrada' }, { status: 404 })
  return NextResponse.json({ demanda })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const anterior = await getDemanda(id)
  const demanda = await atualizarDemanda(id, body)
  if (!demanda) return NextResponse.json({ error: 'Demanda não encontrada' }, { status: 404 })

  const usuarios = await listarUsuariosResponsaveis()
  const responsavel = demanda.responsavelId ? usuarios.find((u) => u.id === demanda.responsavelId) : undefined

  if (anterior && anterior.coluna !== demanda.coluna) {
    if (demanda.coluna === 'concluido') {
      notificarFinalizacao(demanda, responsavel).catch(() => {})
    } else {
      notificarMovimento(demanda, anterior.coluna, demanda.coluna, responsavel).catch(() => {})
    }
  }

  if (anterior && body.descricao !== undefined && body.descricao !== anterior.descricao) {
    notificarEdicaoDescricao(demanda, anterior.descricao ?? '', responsavel).catch(() => {})
  }

  return NextResponse.json({ demanda })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const demanda = await getDemanda(id)
  const ok = await deletarDemanda(id)
  if (!ok) return NextResponse.json({ error: 'Demanda não encontrada' }, { status: 404 })

  if (demanda) {
    const usuarios = await listarUsuariosResponsaveis()
    const responsavel = demanda.responsavelId ? usuarios.find((u) => u.id === demanda.responsavelId) : undefined
    notificarExclusao(demanda, responsavel).catch(() => {})
  }

  return NextResponse.json({ deleted: id })
}
