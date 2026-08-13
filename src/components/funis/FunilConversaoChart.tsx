'use client'

// Visão gráfica da jornada de qualificação de um fluxo: cada tag configurada (na ordem em que o
// lead as recebe — ver FlowTagEditor) é uma etapa do funil. Cada etapa afunila em relação à
// primeira porque leads recebem tags cumulativamente conforme avançam na jornada. Forma contínua
// (um polígono por etapa, encostando exatamente no seguinte — sem gaps) em vez de blocos soltos,
// pra ficar num nível gráfico parecido com dashboards de referência (Sankey/funnel charts).
//
// Duas orientações: "horizontal" (padrão, usado na apresentação pública de página cheia) e
// "vertical" (usado na sidebar de Detalhes — mais estreita, um funil deitado com muitas etapas
// fica ilegível; empilhado verticalmente cada etapa ocupa a largura toda e rola normalmente).

export interface EstagioFunil {
  tag: string
  contagem: number
}

// Tamanho mínimo visível mesmo com contagem 0 — deixa claro que a etapa existe, só não teve leads.
const TAMANHO_MINIMO_PCT = 10
const ALTURA_LINHA_VERTICAL = 88

function PillPercentual({ pct, cor }: { pct: number; cor: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums shrink-0"
      style={{ backgroundColor: `${cor}20`, border: `1px solid ${cor}40`, color: cor }}
    >
      {pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  )
}

export function FunilConversaoChart({ estagios, cor, orientacao = 'horizontal' }: { estagios: EstagioFunil[]; cor?: string; orientacao?: 'horizontal' | 'vertical' }) {
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
  const tamanhos = estagios.map((e) => Math.max((e.contagem / max) * 100, TAMANHO_MINIMO_PCT))

  if (orientacao === 'vertical') {
    return (
      <div className="py-1">
        {estagios.map((estagio, i) => {
          const topoPct = tamanhos[i]
          const basePct = i < n - 1 ? tamanhos[i + 1] : tamanhos[i]
          const padTopo = (100 - topoPct) / 2
          const padBase = (100 - basePct) / 2
          const pct = primeiro > 0 ? (estagio.contagem / primeiro) * 100 : 0
          const opacidade = n > 1 ? 0.32 + (i / (n - 1)) * 0.68 : 1
          return (
            <div key={`${estagio.tag}-${i}`} className={i > 0 ? 'mt-3' : ''}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-mono text-[var(--text-muted)] truncate" title={estagio.tag}>{estagio.tag}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{estagio.contagem}</span>
                  <PillPercentual pct={pct} cor={corBase} />
                </div>
              </div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full block" style={{ height: ALTURA_LINHA_VERTICAL }}>
                <polygon
                  points={`${padTopo},0 ${100 - padTopo},0 ${100 - padBase},100 ${padBase},100`}
                  fill={corBase}
                  opacity={Math.max(opacidade, 0.4)}
                />
              </svg>
            </div>
          )
        })}
      </div>
    )
  }

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
              <PillPercentual pct={pct} cor={corBase} />
            </div>
          )
        })}
      </div>
      <svg viewBox={`0 0 ${100 * n} 100`} preserveAspectRatio="none" className="w-full block" style={{ height: 110 }}>
        {estagios.map((_, i) => {
          const alturaEsq = tamanhos[i]
          const alturaDir = i < n - 1 ? tamanhos[i + 1] : tamanhos[i]
          const x0 = i * 100
          const x1 = (i + 1) * 100
          const topoEsq = (100 - alturaEsq) / 2
          const baseEsq = 100 - topoEsq
          const topoDir = (100 - alturaDir) / 2
          const baseDir = 100 - topoDir
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
              x1={i * 100}
              x2={i * 100}
              y1={0}
              y2={100}
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
