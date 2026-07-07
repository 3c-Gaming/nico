import { NextResponse } from 'next/server'
import { listarTestes } from '@/lib/testes/store'

export async function GET() {
  try {
    const testes = await listarTestes()
    const resumo = {
      total: testes.length,
      ok: testes.filter((t) => t.status === 'ok').length,
      falhas: testes.filter(
        (t) =>
          t.status !== 'ok' && t.status !== 'pending' && t.status !== 'aguardando_resposta'
      ).length,
      pendentes: testes.filter(
        (t) => t.status === 'pending' || t.status === 'aguardando_resposta'
      ).length,
      ultimoTeste: testes[0] || null,
      taxaSucesso:
        testes.length > 0
          ? Math.round(
              (testes.filter((t) => t.status === 'ok').length / testes.length) * 100
            )
          : 0,
    }
    return NextResponse.json(resumo)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
