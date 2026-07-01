import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { listarFlowTagConfigs } = await import('@/lib/db/supabase')
    const configs = await listarFlowTagConfigs()
    return NextResponse.json({ configs })
  } catch {
    return NextResponse.json({ configs: [] })
  }
}
