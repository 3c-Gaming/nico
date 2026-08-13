'use client'

// Visão gráfica da jornada de qualificação de um fluxo: cada tag configurada (na ordem em que o
// lead as recebe — ver FlowTagEditor) é uma etapa do funil. Cada etapa afunila em relação à
// primeira porque leads recebem tags cumulativamente conforme avançam na jornada. Forma contínua
// (um polígono por etapa, encostando exatamente no seguinte — sem gaps) em vez de blocos soltos,
// pra ficar num nível gráfico parecido com dashboards de referência (Sankey/funnel charts).

export interface EstagioFunil {
  tag: string
  contagem: number
}

// Altura mínima visível mesmo com contagem 0 — deixa claro que a etapa existe, só não teve leads.
const ALTURA_MINIMA_PCT = 10
const COL = 100
const ALTURA_SVG = 100

export function FunilConversaoChart({ estagios, cor }: { estagios: EstagioFunil[]; cor?: string }) {
  if (estagios.length === 0) {
    return <p className="text-xs text-[var(--text-muted)]/60 italic py-6 text-center">Nenhuma tag configurada nesse fluxo.</p>
  }
  if (estagios.length === 1) {
    return (
      <p className="text-xs text-[var(--text-muted)]/60 italic py-6 text-center">
        Só uma tag configurada — adicione mais tags (em ordem) na edição do fluxo pra ver o funil de conversão da jornada.
      </p>
    )
  }

  const corBase = cor ?? 'var(--d1)'
  const n = estagios.length
  const max = Math.max(...estagios.map((e) => e.contagem), 1)
  const primeiro = estagios[0].contagem
  const alturas = estagios.map((e) => Math.max((e.contagem / max) * 100, ALTURA_MINIMA_PCT))

  return (
    <div className="py-2 max-w-2xl mx-auto">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {estagios.map((estagio, i) => {
          const pct = primeiro > 0 ? (estagio.contagem / primeiro) * 100 : 0
          return (
            <div
              key={`${estagio.tag}-label-${i}`}
              className={`flex flex-col items-center gap-1 px-2 pb-2 ${i > 0 ? 'border-l border-[var(--border)]' : ''}`}
            >
              <span className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-full" title={estagio.tag}>
                {estagio.tag}
              </span>
              <span className="text-base font-bold text-[var(--text-primary)] tabular-nums">{estagio.contagem}</span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums"
                style={{ backgroundColor: `${corBase}20`, border: `1px solid ${corBase}40`, color: corBase }}
              >
                {pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
              </span>
            </div>
          )
        })}
      </div>
      <svg viewBox={`0 0 ${COL * n} ${ALTURA_SVG}`} preserveAspectRatio="none" className="w-full block" style={{ height: 110 }}>
        {estagios.map((_, i) => {
          const alturaEsq = alturas[i]
          const alturaDir = i < n - 1 ? alturas[i + 1] : alturas[i]
          const x0 = i * COL
          const x1 = (i + 1) * COL
          const topoEsq = (ALTURA_SVG - alturaEsq) / 2
          const baseEsq = ALTURA_SVG - topoEsq
          const topoDir = (ALTURA_SVG - alturaDir) / 2
          const baseDir = ALTURA_SVG - topoDir
          // Gradiente claro → escuro conforme afunila, mesmo efeito dos dashboards de referência.
          const opacidade = n > 1 ? 0.32 + (i / (n - 1)) * 0.68 : 1
          return (
            <polygon
              key={i}
              points={`${x0},${topoEsq} ${x1},${topoDir} ${x1},${baseDir} ${x0},${baseEsq}`}
              fill={corBase}
              opacity={opacidade}
            />
          )
        })}
        {estagios.slice(1).map((_, idx) => {
          const i = idx + 1
          return (
            <line
              key={i}
              x1={i * COL}
              x2={i * COL}
              y1={0}
              y2={ALTURA_SVG}
              stroke="var(--border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
    </div>
  )
}
