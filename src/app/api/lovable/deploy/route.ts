import { NextResponse } from 'next/server'
import { setCachedCastleToken, deployLovable } from '@/lib/paginas/lovable-deploy'

export async function POST(req: Request) {
  try {
    const { projectId, castleToken } = await req.json()
    if (!projectId || !castleToken) {
      return NextResponse.json({ error: 'projectId e castleToken obrigatórios' }, { status: 400 })
    }

    // Cachear o Castle token para uso futuro pelo bot
    setCachedCastleToken(castleToken)

    const result = await deployLovable(projectId)
    if (result.ok) {
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: result.message }, { status: 500 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
