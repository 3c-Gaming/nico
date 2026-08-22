import { NextResponse } from 'next/server'
import { listarContasSendpulse } from '@/lib/integrações/contasSendpulse'
import { getPreferencias, atualizarNomeConta } from '@/lib/db/supabase'

/** Lista as contas SendPulse configuradas (via .env) já com o nome amigável que o usuário deu a
 * cada uma na tela de Configurações — sem isso, cai no fallback "Conta 01"/"Conta 02" (a
 * SendPulse não expõe nome/e-mail do dono da conta pela API, só plano/uso). */
export async function GET() {
  try {
    const contas = listarContasSendpulse()
    const { contaNomes } = await getPreferencias()
    return NextResponse.json({
      contas: contas.map((c) => ({ id: c.id, nome: contaNomes[c.id] ?? c.nome })),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const contaId = String(body.contaId ?? '')
    const nome = String(body.nome ?? '').trim()
    if (!contaId) return NextResponse.json({ error: 'contaId é obrigatório' }, { status: 400 })
    if (!nome) return NextResponse.json({ error: 'nome não pode ser vazio' }, { status: 400 })

    const contas = listarContasSendpulse()
    if (!contas.some((c) => c.id === contaId)) {
      return NextResponse.json({ error: `Conta ${contaId} não configurada` }, { status: 404 })
    }

    const contaNomes = await atualizarNomeConta(contaId, nome)
    return NextResponse.json({
      contas: contas.map((c) => ({ id: c.id, nome: contaNomes[c.id] ?? c.nome })),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
