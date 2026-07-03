import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { listarCacheMetricas } = await import('@/lib/db/supabase')
    const metricas = await listarCacheMetricas()
    return NextResponse.json({ metricas })
  } catch {
    return NextResponse.json({ metricas: [] })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { upsertCacheMetricas } = await import('@/lib/db/supabase')
    const body = await request.json()
    const metricas = Array.isArray(body) ? body : [body]
    const data = await upsertCacheMetricas(metricas)
    return NextResponse.json({ metricas: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
