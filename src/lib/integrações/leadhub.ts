import type { BaseCSV } from '@/types'

// TODO: [INTEGRATION PENDING] Implementar cliente real do LeadHub com credenciais

export async function listarBases(): Promise<{ id: string; nome: string; totalRegistros: number; criadoEm: string }[]> {
  // Stub: retorna dados mockados
  return [
    { id: 'base_001', nome: 'Base SuperBet Junho 2026', totalRegistros: 4821, criadoEm: '2026-06-15T10:00:00Z' },
    { id: 'base_002', nome: 'Base BetMGM Julho 2026', totalRegistros: 2150, criadoEm: '2026-06-18T14:30:00Z' },
    { id: 'base_003', nome: 'Base EsportivaBet Promo', totalRegistros: 3100, criadoEm: '2026-06-20T09:00:00Z' },
  ]
}

export async function baixarBase(baseId: string): Promise<{ status: string; caminhoLocal: string; totalRegistros: number }> {
  // TODO: [INTEGRATION PENDING] Chamar endpoint de download do LeadHub e salvar CSV
  return { status: 'ok', caminhoLocal: `/tmp/base_${baseId}.csv`, totalRegistros: 0 }
}
