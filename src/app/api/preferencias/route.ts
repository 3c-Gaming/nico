import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { getPreferencias } = await import('@/lib/db/supabase')
    const prefs = await getPreferencias()
    return NextResponse.json(prefs)
  } catch {
    return NextResponse.json({ pinnedNumeros: [], pinnedFunis: [] })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { updatePreferencias } = await import('@/lib/db/supabase')
    const body = await request.json()
    await updatePreferencias(body.pinnedNumeros ?? [], body.pinnedFunis ?? [])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
