import { NextRequest, NextResponse } from 'next/server'
import { obterPastaPorNome, criarPasta, copiarArquivosEntrePastas, subtrairDias, listarPastasFilhas, listarArquivos } from '@/lib/integrações/googleDrive'

const SUBPASTAS = ['D1', 'D3', 'D5', 'D7']
const OFFSETS: Record<string, number> = { D3: 2, D5: 4, D7: 6 }

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json()
    if (!data || !/^\d{4}$/.test(data)) {
      return NextResponse.json({ error: 'data deve estar no formato DDMM' }, { status: 400 })
    }

    const pastaData = await obterPastaPorNome(data)
    if (!pastaData) {
      return NextResponse.json({ error: `Pasta ${data} não encontrada` }, { status: 404 })
    }

    const subpastasExistentes = await listarPastasFilhas(pastaData.id)
    const existe = (nome: string) => subpastasExistentes.some((s) => s.nome === nome)

    const resultados: { tipo: string; criados: number }[] = []

    for (const tipo of SUBPASTAS) {
      if (!existe(tipo)) {
        await criarPasta(tipo, pastaData.id)
      }
    }

    for (const tipo of ['D3', 'D5', 'D7'] as const) {
      const offset = OFFSETS[tipo]
      const dataOrigem = subtrairDias(data, offset)
      const pastaOrigemData = await obterPastaPorNome(dataOrigem)
      if (!pastaOrigemData) {
        resultados.push({ tipo, criados: 0 })
        continue
      }

      const pastaOrigemD1 = await obterPastaPorNome('D1', pastaOrigemData.id)
      if (!pastaOrigemD1) {
        resultados.push({ tipo, criados: 0 })
        continue
      }

      const arquivosOrigem = await listarArquivos(pastaOrigemD1.id)
      if (arquivosOrigem.length === 0) {
        resultados.push({ tipo, criados: 0 })
        continue
      }

      const pastaDestino = await obterPastaPorNome(tipo, pastaData.id)
      if (!pastaDestino) {
        resultados.push({ tipo, criados: 0 })
        continue
      }

      const criados = await copiarArquivosEntrePastas(pastaOrigemD1.id, pastaDestino.id)
      resultados.push({ tipo, criados: criados.length })
    }

    return NextResponse.json({ resultados, pastaData })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
