import { NextResponse } from 'next/server'
import { listarPastas, listarPastasFilhas, listarArquivos } from '@/lib/integrações/googleDrive'
import type { DriveFile } from '@/types'

const SUBPASTAS = ['D1', 'D3', 'D5', 'D7'] as const

interface ArquivoAnalise {
  id: string
  nome: string
  tamanho: number
  slugCasa: string | null
}

interface DisparoAnalise {
  tipo: typeof SUBPASTAS[number]
  arquivos: ArquivoAnalise[]
}

interface PastaAnalise {
  data: string
  id: string
  disparos: DisparoAnalise[]
  totalArquivos: number
}

export async function GET() {
  try {
    const pastasRaiz = await listarPastas()
    const analise: PastaAnalise[] = []

    for (const pasta of pastasRaiz) {
      if (!/^\d{4}$/.test(pasta.nome)) continue

      const subpastas = await listarPastasFilhas(pasta.id)
      const disparos: DisparoAnalise[] = []

      for (const tipo of SUBPASTAS) {
        const sub = subpastas.find((s) => s.nome === tipo)
        if (!sub) {
          disparos.push({ tipo, arquivos: [] })
          continue
        }

        const arquivos = await listarArquivos(sub.id)
        disparos.push({
          tipo,
          arquivos: arquivos.map((arq: DriveFile) => ({
            id: arq.id,
            nome: arq.nome,
            tamanho: arq.tamanho,
            slugCasa: extrairSlug(arq.nome),
          })),
        })
      }

      const totalArquivos = disparos.reduce((acc, d) => acc + d.arquivos.length, 0)
      if (totalArquivos > 0) {
        analise.push({ data: pasta.nome, id: pasta.id, disparos, totalArquivos })
      }
    }

    // Unique casa slugs found across all folders
    const todasSlugs = new Set<string>()
    for (const pasta of analise) {
      for (const disp of pasta.disparos) {
        for (const arq of disp.arquivos) {
          if (arq.slugCasa) todasSlugs.add(arq.slugCasa!)
        }
      }
    }

    return NextResponse.json({
      pastas: analise,
      slugsEncontrados: Array.from(todasSlugs).sort(),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

function extrairSlug(nome: string): string | null {
  // Esperado: base_{slug}_{DDMM}.csv  ou  base_{slug}.csv
  const semExt = nome.replace(/\.csv$/i, '')
  const partes = semExt.split('_')
  // Pega o segundo elemento se o primeiro for "base"
  if (partes.length >= 2 && partes[0].toLowerCase() === 'base') {
    return partes[1].toLowerCase()
  }
  return null
}
