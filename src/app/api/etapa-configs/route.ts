import { NextRequest, NextResponse } from 'next/server'
import type { EsteiraEtapaConfig } from '@/types'
import { listarEtapaConfigs, atualizarEtapaConfigs } from '@/lib/api-store'

export async function GET() {
  const configs = await listarEtapaConfigs()
  return NextResponse.json({ configs })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const configs: EsteiraEtapaConfig[] = body.configs ?? []
  const result = await atualizarEtapaConfigs(configs)
  return NextResponse.json({ configs: result })
}
