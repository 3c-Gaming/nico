import { NextResponse } from 'next/server'
import { listarResultados } from '@/lib/bot-test/store'

export async function GET() {
  try {
    const resultados = await listarResultados()
    return NextResponse.json({ resultados })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
