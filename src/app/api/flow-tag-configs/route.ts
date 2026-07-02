import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { listarFlowTagConfigs } = await import('@/lib/db/supabase')
    const configs = await listarFlowTagConfigs()
    return NextResponse.json({ configs })
  } catch {
    return NextResponse.json({ configs: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { atualizarFlowTagConfig } = await import('@/lib/db/supabase')
    const body = await request.json()
    const config = await atualizarFlowTagConfig(body)
    return NextResponse.json({ config })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { deletarFlowTagConfig } = await import('@/lib/db/supabase')
    const { searchParams } = new URL(request.url)
    const flowId = searchParams.get('flowId')
    if (!flowId) return NextResponse.json({ error: 'flowId obrigatório' }, { status: 400 })
    await deletarFlowTagConfig(flowId)
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
