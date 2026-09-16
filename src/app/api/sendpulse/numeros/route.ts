import { NextRequest, NextResponse } from 'next/server'
import { listarNumerosTodasContas, idsContasComPlanoAtivo } from '@/lib/integrações/sendpulse'
import { getOrFetch } from '@/lib/cache'

const TTL_MS = 5 * 60_000

// Sem ?canal, mantém o comportamento de sempre (só WhatsApp) — os ~10 outros consumidores dessa
// rota (Disparos, Configurações, etc.) não sabem de Telegram e não devem ver bots de Telegram
// aparecendo do nada. Só quem pede explicitamente (?canal=telegram ou ?canal=todos, hoje só a
// tela de Números e o filtro de Bot dos Funis) recebe os dois canais.
export async function GET(request: NextRequest) {
  const canalParam = request.nextUrl.searchParams.get('canal')
  const canais = canalParam === 'telegram' ? (['telegram'] as const)
    : canalParam === 'todos' ? (['whatsapp', 'telegram'] as const)
    : (['whatsapp'] as const)
  // Opt-in — só quem pede explicitamente (hoje só a tela de Funis) some com números de conta com
  // plano expirado/excedido. Filtro global quebraria Disparos/monitoramento pra conta que ainda
  // está enviando mesmo com o plano vencido (ver decisão no commit/plano dessa mudança).
  const apenasContasAtivas = request.nextUrl.searchParams.get('apenasContasAtivas') === 'true'

  try {
    const numeros = await getOrFetch('numeros', canais.join(','), TTL_MS, () =>
      listarNumerosTodasContas(AbortSignal.timeout(15_000), [...canais])
    )
    if (!apenasContasAtivas) return NextResponse.json({ numeros })

    const ativas = await idsContasComPlanoAtivo()
    return NextResponse.json({ numeros: numeros.filter((n) => !n.contaId || ativas.has(n.contaId)) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
