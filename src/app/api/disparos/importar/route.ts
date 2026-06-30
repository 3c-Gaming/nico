import { NextRequest, NextResponse } from 'next/server'
import type { Disparo, Esteira, TipoDisparo } from '@/types'
import { getApiStore } from '@/lib/api-store'
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

    const store = getApiStore()
    const agora = new Date().toISOString()
    const disparosCriados: Disparo[] = []
    const esteirasCriadas: Esteira[] = []

    // Agrupar por data para criar esteiras
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

      // Criar um disparo para cada item
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
        store.disparos[id] = dis
      }

      // Contar linhas de cada CSV em paralelo
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

      // Criar esteira se tiver D1
      if (d1) {
        const disD1 = disparosDoGrupo.get('D1')
        if (disD1) {
          const todasCasas = itens.flatMap((i) => i.slugCasas)
          const casasUnicas = [...new Set(todasCasas)]

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
            criadaEm: agora,
            atualizadoEm: agora,
            ativa: true,
          }
          esteirasCriadas.push(esteira)
          store.esteiras[esteira.id] = esteira

          // Vincular disparos à esteira
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
  // data é "DDMM" — converter para ISO "YYYY-MM-DD"
  if (data.length !== 4) return data
  const dia = data.slice(0, 2)
  const mes = data.slice(2, 4)
  const ano = '2025'
  return `${ano}-${mes}-${dia}`
}
