import { NextResponse } from 'next/server'
import { PAINEIS_PILHADO } from '@/lib/pilhadoPremios'
import { sincronizarPainel } from '@/lib/pilhadoPremiosSync'

export const maxDuration = 120

// As 3 contas rodam em paralelo (Promise.all): sequencial poderia somar até ~3x o tempo de uma
// conta lenta e estourar o maxDuration da função.
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const resultados = await Promise.all(PAINEIS_PILHADO.map((painel) => sincronizarPainel(painel)))

  const falhas = resultados.filter((r) => !r.ok).map((r) => `${r.painel}: ${r.erro}`)
  for (const f of falhas) console.error('[cron/pilhado-premios-sync]', f)

  return NextResponse.json({ ok: true, resultados, falhas })
}
