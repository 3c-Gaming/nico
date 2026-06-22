import { NextResponse } from 'next/server'

export async function GET() {
  // TODO: [INTEGRATION PENDING] Implementar com credenciais do LeadHub
  return NextResponse.json({
    bases: [
      { id: 'base_001', nome: 'Base SuperBet Junho 2026', totalRegistros: 4821, criadoEm: '2026-06-15T10:00:00Z' },
      { id: 'base_002', nome: 'Base BetMGM Julho 2026', totalRegistros: 2150, criadoEm: '2026-06-18T14:30:00Z' },
      { id: 'base_003', nome: 'Base EsportivaBet Promo', totalRegistros: 3100, criadoEm: '2026-06-20T09:00:00Z' },
    ],
  })
}
