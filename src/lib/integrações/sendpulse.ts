import type { NumeroSendpulse } from '@/types'

// TODO: [INTEGRATION PENDING] Implementar cliente real da Sendpulse

export async function listarNumeros(): Promise<NumeroSendpulse[]> {
  // Stub: retorna dados mockados
  return [
    { id: 'num_001', numero: '+5511999990000', chatbotId: 'chat_001', descricao: 'SB Receptivo ODD 100x' },
    { id: 'num_002', numero: '+5511999991111', chatbotId: 'chat_002', descricao: 'MGM Geral' },
    { id: 'num_003', numero: '+5511999992222', chatbotId: 'chat_003', descricao: 'Esportiva Bet VIP' },
  ]
}
