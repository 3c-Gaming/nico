import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { baseId } = body

  // TODO: [INTEGRATION PENDING] Chamar endpoint de download do LeadHub e salvar CSV
  return NextResponse.json({
    status: 'ok',
    caminhoLocal: `/tmp/base_${baseId}.csv`,
    totalRegistros: 4821,
  })
}
