import { NextResponse } from 'next/server'
import { listarResultados } from '@/lib/bot-test/store'
import { iniciarCron } from '@/lib/bot-test/cron'

export async function GET() {
  try {
    await iniciarCron()
    const resultados = await listarResultados()
    return NextResponse.json({ resultados })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
