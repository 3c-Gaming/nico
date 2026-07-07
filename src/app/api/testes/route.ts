import { NextResponse } from 'next/server'
import { listarTestes } from '@/lib/testes/store'
import { executarTeste } from '@/lib/testes/runner'
import type { TestRequest } from '@/lib/testes/types'

export async function GET() {
  try {
    const testes = await listarTestes()
    return NextResponse.json({ testes })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body: TestRequest = await req.json()
    if (!body.botId) {
      return NextResponse.json({ error: 'botId é obrigatório' }, { status: 400 })
    }
    const resultado = await executarTeste(body)
    return NextResponse.json({ resultado })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
