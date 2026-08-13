'use client'

// Visão gráfica da jornada de qualificação de um fluxo: cada tag configurada (na ordem em que o
// lead as recebe — ver FlowTagEditor) é uma etapa do funil. Cada etapa afunila em relação à
// anterior porque leads recebem tags cumulativamente conforme avançam na jornada.

export interface EstagioFunil {
  tag: string
  contagem: number
}

function trapezoidClipPath(topPct: number, bottomPct: number): string {
  const topPad = (100 - topPct) / 2
  const bottomPad = (100 - bottomPct) / 2
  return `polygon(${topPad}% 0%, ${100 - topPad}% 0%, ${100 - bottomPad}% 100%, ${bottomPad}% 100%)`
}

// Largura mínima visível mesmo com contagem 0 — deixa claro que a etapa existe, só não teve leads.
const LARGURA_MINIMA_PCT = 14

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
  const max = Math.max(...estagios.map((e) => e.contagem), 1)
  const primeiro = estagios[0].contagem
  const ultimo = estagios[estagios.length - 1].contagem
  const larguras = estagios.map((e) => Math.max((e.contagem / max) * 100, LARGURA_MINIMA_PCT))

  return (
    <div className="py-3 max-w-md mx-auto">
      {estagios.map((estagio, i) => {
        const topPct = larguras[i]
        const bottomPct = i < larguras.length - 1 ? larguras[i + 1] : larguras[i]
        const proximo = i < estagios.length - 1 ? estagios[i + 1].contagem : null
        // % de queda pra próxima etapa — não pra anterior (o rótulo fica embaixo desta etapa,
        // então precisa descrever a transição pra frente, não pra trás).
        const pctProximo = proximo != null && estagio.contagem > 0 ? (proximo / estagio.contagem) * 100 : null
        const shade = 1 - i * (0.45 / Math.max(estagios.length - 1, 1))
        return (
          <div key={`${estagio.tag}-${i}`}>
            <div className="relative h-14 flex items-center justify-center">
              {/* Fundo decorativo com o recorte trapezoidal — o rótulo fica num badge à parte
                  (abaixo), não dentro do recorte, senão etapas estreitas (contagem baixa) cortam
                  visualmente o texto que passa da largura do trapézio. */}
              <div
                className="absolute inset-0"
                style={{ clipPath: trapezoidClipPath(topPct, bottomPct), backgroundColor: corBase, opacity: Math.max(shade, 0.4) }}
              />
              <div className="relative flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm">
                <span className="text-xs font-mono font-semibold text-[var(--text-primary)] truncate max-w-[180px]">{estagio.tag}</span>
                <span className="text-sm font-bold text-[var(--text-primary)] shrink-0">{estagio.contagem}</span>
              </div>
            </div>
            {i < estagios.length - 1 && (
              <div className="flex items-center justify-center gap-1 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                <span>↓</span>
                <span>{pctProximo != null ? `${pctProximo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% seguiram` : 'sem dados'}</span>
              </div>
            )}
          </div>
        )
      })}
      <div className="pt-2 text-center text-[10px] text-[var(--text-muted)]">
        Conversão total: {primeiro > 0 ? `${((ultimo / primeiro) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}
        {' '}({estagios[0].tag} → {estagios[estagios.length - 1].tag})
      </div>
    </div>
  )
}
