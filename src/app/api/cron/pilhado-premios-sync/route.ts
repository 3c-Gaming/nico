import { NextResponse } from 'next/server'
import { contaBridgeDoPainel, PAINEIS_PILHADO, type ContaBridgeH2Premios } from '@/lib/pilhadoPremios'
import { buscarVendasPorDia, type VendasPorDia } from '@/lib/integrações/h2premios'
import { listarDisparosPilhado, atualizarDisparoPilhado } from '@/lib/db/supabase'
import { hojeBrasilISO } from '@/lib/datas'

export const maxDuration = 300

const JANELA_DIAS = 14

// Um scrape por conta cobre toda a janela de dias de uma vez (a fonte é a lista de compras
// paginada), então isso é 3 buscas no total por execução, não uma por disparo.
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const hoje = hojeBrasilISO()
  const limite = new Date(`${hoje}T00:00:00Z`)
  limite.setUTCDate(limite.getUTCDate() - JANELA_DIAS)
  const dataLimite = limite.toISOString().slice(0, 10)

  const todos = await listarDisparosPilhado()
  const recentes = todos.filter((d) => d.data >= dataLimite)

  const porConta = new Map<ContaBridgeH2Premios, VendasPorDia>()
  const falhas: string[] = []

  for (const painel of PAINEIS_PILHADO) {
    const conta = contaBridgeDoPainel(painel)
    if (!conta) continue
    try {
      porConta.set(conta, await buscarVendasPorDia(conta))
    } catch (err) {
      falhas.push(`${conta}: ${(err as Error).message}`)
      console.error('[cron/pilhado-premios-sync]', conta, (err as Error).message)
    }
  }

  let ok = 0
  let semDado = 0

  for (const disparo of recentes) {
    const conta = contaBridgeDoPainel(disparo.painel)
    const porDia = conta ? porConta.get(conta) : undefined
    if (!porDia) { semDado++; continue }

    const doDia = porDia[disparo.data] ?? { vendas: 0, faturamento: 0 }
    await atualizarDisparoPilhado(disparo.id, { vendas: doDia.vendas, faturamento: doDia.faturamento })
    ok++
  }

  return NextResponse.json({ ok: true, total: recentes.length, sincronizados: ok, semDado, falhas })
}
