import { NextResponse } from 'next/server'
import { PAINEIS_PILHADO } from '@/lib/pilhadoPremios'
import { sincronizarPainelDesde } from '@/lib/pilhadoPremiosSync'
import { hojeBrasilISO, primeiroDiaDoMes } from '@/lib/datas'

export const maxDuration = 300

// Sincroniza o mês corrente inteiro (não só uma janela fixa de dias) — vendas de um disparo
// continuam chegando ao longo do mês, e assim cobrimos qualquer disparo do mês numa passada só.
// As 3 contas rodam em paralelo (Promise.all): sequencial poderia somar até ~3x o tempo de uma
// conta lenta e estourar o maxDuration da função.
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const inicioMes = primeiroDiaDoMes(hojeBrasilISO())
  const resultados = await Promise.all(PAINEIS_PILHADO.map((painel) => sincronizarPainelDesde(painel, inicioMes)))

  const falhas = resultados.filter((r) => !r.ok).map((r) => `${r.painel}: ${r.erro}`)
  for (const f of falhas) console.error('[cron/pilhado-premios-sync]', f)

  return NextResponse.json({
    ok: true,
    mes: inicioMes,
    sincronizados: resultados.reduce((acc, r) => acc + r.atualizados, 0),
    resultados,
    falhas,
  })
}
