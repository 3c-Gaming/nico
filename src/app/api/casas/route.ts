import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { listarCasas } = await import('@/lib/db/supabase')
    const casas = await listarCasas()
    return NextResponse.json({ casas })
  } catch {
    return NextResponse.json({ casas: [] })
  }
}
