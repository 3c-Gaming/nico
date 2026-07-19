import { NextRequest, NextResponse } from 'next/server'
import type { Disparo, Esteira, TipoDisparo } from '@/types'
import { criarDisparo, criarEsteira } from '@/lib/api-store'
import { downloadArquivo } from '@/lib/integrações/googleDrive'

interface ImportarItem {
  data: string
  tipo: TipoDisparo
  slugCasas: string[]
  nomeCasas: string[]
  nomeArquivo: string
  driveFileId: string
  driveFolderId: string
  driveFolderPath: string
  nomenclatura?: string
}

interface ImportarRequest {
  items: ImportarItem[]
}

export async function POST(request: NextRequest) {
  try {
    const { items } = (await request.json()) as ImportarRequest
    if (!items?.length) {
      return NextResponse.json({ error: 'Nenhum item para importar' }, { status: 400 })
    }

    const agora = new Date().toISOString()
    const disparosCriados: Disparo[] = []
    const esteirasCriadas: Esteira[] = []

    const porData = new Map<string, ImportarItem[]>()
    for (const item of items) {
      const prev = porData.get(item.data) ?? []
      prev.push(item)
      porData.set(item.data, prev)
    }

    for (const [, itens] of porData) {
      const d1 = itens.find((i) => i.tipo === 'D1')
      const d3 = itens.find((i) => i.tipo === 'D3')
      const d5 = itens.find((i) => i.tipo === 'D5')
      const d7 = itens.find((i) => i.tipo === 'D7')

      const disparosDoGrupo: Map<string, Disparo> = new Map()

      for (const item of itens) {
        const id = crypto.randomUUID()
        const dataDisparo = parseDataFolder(item.data)
        const nomenclatura =
          item.nomenclatura ??
          `Retro: ${item.data}-${item.tipo}`

        const dis: Disparo = {
          id,
          tipo: item.tipo,
          nomenclatura,
          status: 'executado',
          casasAposta: item.slugCasas,
          dataDisparo,
          horarioDisparo: '10:00',
          base: {
            driveFileId: item.driveFileId,
            driveFolderId: item.driveFolderId,
            driveFolderPath: item.driveFolderPath,
            nomeArquivo: item.nomeArquivo,
            status: 'disponivel',
          },
          criadoEm: agora,
          atualizadoEm: agora,
        }
        disparosDoGrupo.set(item.tipo, dis)
        disparosCriados.push(dis)
        await criarDisparo(dis)
      }

      await Promise.all(
        itens.map(async (item) => {
          const dis = disparosDoGrupo.get(item.tipo)
          if (!dis) return
          try {
            const { buffer } = await downloadArquivo(item.driveFileId)
            const texto = new TextDecoder().decode(buffer)
            const linhas = texto.split('\n').filter((l) => l.trim().length > 0)
            dis.base.totalRegistros = Math.max(0, linhas.length - 1)
          } catch {
            // falha silenciosa na contagem
          }
        })
      )

      if (d1) {
        const disD1 = disparosDoGrupo.get('D1')
        if (disD1) {
          const todasCasas = itens.flatMap((i) => i.slugCasas)
          const casasUnicas = [...new Set(todasCasas)]

          const etapas: { tipo: string; disparoId: string }[] = [{ tipo: 'D1', disparoId: disD1.id }]
          if (d3 && disparosDoGrupo.get('D3')) etapas.push({ tipo: 'D3', disparoId: disparosDoGrupo.get('D3')!.id })
          if (d5 && disparosDoGrupo.get('D5')) etapas.push({ tipo: 'D5', disparoId: disparosDoGrupo.get('D5')!.id })
          if (d7 && disparosDoGrupo.get('D7')) etapas.push({ tipo: 'D7', disparoId: disparosDoGrupo.get('D7')!.id })

          const esteira: Esteira = {
            id: crypto.randomUUID(),
            nome: `Retro: ${d1.data}`,
            casasAposta: casasUnicas,
            disparos: {
              d1: disD1.id,
              ...(d3 ? { d3: disparosDoGrupo.get('D3')!.id } : {}),
              ...(d5 ? { d5: disparosDoGrupo.get('D5')!.id } : {}),
              ...(d7 ? { d7: disparosDoGrupo.get('D7')!.id } : {}),
            },
            etapas,
            criadoEm: agora,
            atualizadoEm: agora,
            ativa: true,
          }
          esteirasCriadas.push(esteira)
          await criarEsteira(esteira)

          for (const [, dis] of disparosDoGrupo) {
            dis.esteiraPaiId = esteira.id
          }
        }
      }
    }

    return NextResponse.json({ disparos: disparosCriados, esteiras: esteirasCriadas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

function parseDataFolder(data: string): string {
  if (data.length !== 4) return data
  const dia = data.slice(0, 2)
  const mes = data.slice(2, 4)
  const ano = '2025'
  return `${ano}-${mes}-${dia}`
}
