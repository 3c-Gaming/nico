'use client'

import { useEffect, useState } from 'react'
import { buscarResultadoUtm, CUSTO_POR_ENTREGUE, VALOR_CPA } from '@/lib/resultadoDisparo'
import type { ResultadoUtm } from '@/lib/resultadoDisparo'

interface UseResultadoDisparoParams {
  utmValor?: string
  casa: 'superbet' | 'betmgm' | null
  data?: string
  entregues?: number
  /** Sobrescreve CUSTO_POR_ENTREGUE (fixo, pensado pro WhatsApp) — usado por disparos SMS, cujo
   * custo por envio é digitado na criação (Disparo.custoPorEnvio), não previsível como o do
   * WhatsApp. */
  custoPorUnidade?: number
}

interface UseResultadoDisparoReturn {
  resultado: ResultadoUtm | null
  carregando: boolean
  custo: number
  receita: number
  roi: number | null
}

const REFETCH_MS = 5 * 60_000

/** Busca e calcula registros/FTDs/CPAs/custo/receita/ROI pra uma UTM/PID+casa+data — mesma lógica usada no card do calendário, reaproveitável em qualquer lugar que precise mostrar o resultado de um disparo já cadastrado. Rebusca periodicamente pra pegar novos registros/FTDs ao longo do dia e, principalmente, pra passar a trazer CPA/ROI sozinho assim que o dia vira, sem precisar recarregar a página. */
export function useResultadoDisparo({ utmValor, casa, data, entregues, custoPorUnidade }: UseResultadoDisparoParams): UseResultadoDisparoReturn {
  const [resultado, setResultado] = useState<ResultadoUtm | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), REFETCH_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!utmValor || !casa || !data) { setResultado(null); return }
    let cancelado = false

    setCarregando(true)
    buscarResultadoUtm(utmValor, casa, data)
      .then((r) => { if (!cancelado) setResultado(r) })
      .catch(() => { if (!cancelado) setResultado(null) })
      .finally(() => { if (!cancelado) setCarregando(false) })

    return () => { cancelado = true }
  }, [utmValor, casa, data, tick])

  const valorCPA = casa ? VALOR_CPA[casa] : 0
  const custo = entregues != null ? entregues * (custoPorUnidade ?? CUSTO_POR_ENTREGUE) : 0
  const receita = resultado?.cpas != null ? resultado.cpas * valorCPA : 0
  const roi = resultado?.cpas != null && custo > 0 && valorCPA > 0 ? receita / custo : null

  return { resultado, carregando, custo, receita, roi }
}
