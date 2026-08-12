// Busca leads por dia via LeadHub — uma chamada por tag (pro range inteiro, não por dia), em
// lotes paralelos limitados pra não sobrecarregar a função externa nem disparar tudo de uma vez
// sem controle quando o funil selecionado tem muitas tags.

export interface ProgressoLeadHub {
  concluidos: number
  total: number
}

const LOTE_TAMANHO = 6

async function buscarTagPorDia(tag: string, dataInicio: string, dataFim: string): Promise<Record<string, number>> {
  const res = await fetch('/api/leadhub/leads-por-dia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, dataInicio, dataFim }),
  })
  if (!res.ok) return {}
  const data = await res.json()
  return data.porDia ?? {}
}

/** Devolve tag -> data (YYYY-MM-DD) -> contagem de leads, buscando cada tag única em paralelo
 * (em lotes de 6) e chamando onProgresso conforme cada uma resolve. */
export async function buscarLeadsPorDiaLeadHub(
  tags: string[],
  dataInicio: string,
  dataFim: string,
  onProgresso?: (p: ProgressoLeadHub) => void,
): Promise<Record<string, Record<string, number>>> {
  const unicas = [...new Set(tags)]
  const resultado: Record<string, Record<string, number>> = {}
  let concluidos = 0
  onProgresso?.({ concluidos, total: unicas.length })

  for (let i = 0; i < unicas.length; i += LOTE_TAMANHO) {
    const lote = unicas.slice(i, i + LOTE_TAMANHO)
    await Promise.allSettled(
      lote.map(async (tag) => {
        resultado[tag] = await buscarTagPorDia(tag, dataInicio, dataFim)
        concluidos++
        onProgresso?.({ concluidos, total: unicas.length })
      }),
    )
  }

  return resultado
}
