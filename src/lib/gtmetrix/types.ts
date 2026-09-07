export interface GtmetrixCreditos {
  erro: 'auth' | string | null
  creditos: number
  refill: string
}

export interface GtmetrixPreCheck {
  url: string
  ok: boolean
  status: number
  motivo: string
}

export interface GtmetrixMetricas {
  score: number
  gtmetrix: number
  grade: string
  lcp_ms: number
  tbt_ms: number
  cls_num: number
  lcp: string
  tbt: string
  cls: string
  speed_index: string
  load_time: string
  fcp: string
  ttfb: string
  report_url: string
}

export interface GtmetrixConcluido {
  url: string
  dados: GtmetrixMetricas
}

export interface GtmetrixFalha {
  url: string
  motivo: string
}

export interface GtmetrixPendente {
  url: string
  testId: string
}

/** Resultado consolidado de uma rodada (cron ou /gtmetrix-lista). */
export interface GtmetrixRodada {
  totalTestado: number
  creditosAntes: number | null
  creditosDepois: number | string
  ok: GtmetrixConcluido[]
  comProblema: { url: string; dados: GtmetrixMetricas; problemas: string[] }[]
  quebradas: GtmetrixPreCheck[]
  falhasApi: GtmetrixFalha[]
}
