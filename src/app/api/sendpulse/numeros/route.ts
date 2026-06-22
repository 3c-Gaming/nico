import { NextResponse } from 'next/server'

export async function GET() {
  // TODO: [INTEGRATION PENDING] Buscar via Sendpulse API
  return NextResponse.json({
    numeros: [
      { id: 'num_001', numero: '+5511999990000', chatbotId: 'chat_001', descricao: 'SB Receptivo ODD 100x' },
      { id: 'num_002', numero: '+5511999991111', chatbotId: 'chat_002', descricao: 'MGM Geral' },
      { id: 'num_003', numero: '+5511999992222', chatbotId: 'chat_003', descricao: 'Esportiva Bet VIP' },
    ],
  })
}
