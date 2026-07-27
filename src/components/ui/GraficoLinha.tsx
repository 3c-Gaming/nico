'use client'

import { useState, useRef } from 'react'

export interface PontoLinha {
  label: string
  valor: number
}

export interface SerieLinha {
  nome: string
  cor: string
  pontos: PontoLinha[]
}

interface GraficoLinhaProps {
  pontos?: PontoLinha[]
  cor?: string
  series?: SerieLinha[]
  formatarValor?: (v: number) => string
  altura?: number
}

const LARGURA = 600
const PAD_TOP = 16
const PAD_BOTTOM = 26
const PAD_X = 16

export function GraficoLinha({ pontos, cor = 'var(--d1)', series, formatarValor, altura = 160 }: GraficoLinhaProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const todasSeries: SerieLinha[] = series ?? [{ nome: '', cor, pontos: pontos ?? [] }]
  const labels = todasSeries[0]?.pontos.map((p) => p.label) ?? []
  const multiSeries = todasSeries.length > 1

  const max = Math.max(...todasSeries.flatMap((s) => s.pontos.map((p) => p.valor)), 1)
  const plotW = LARGURA - PAD_X * 2
  const plotH = altura - PAD_TOP - PAD_BOTTOM
  const fmt = formatarValor ?? ((v: number) => String(v))

  const seriesCoords = todasSeries.map((s) => ({
    ...s,
    coords: s.pontos.map((p, i) => {
      const x = PAD_X + (labels.length > 1 ? (i / (labels.length - 1)) * plotW : plotW / 2)
      const y = PAD_TOP + plotH - (max > 0 ? (p.valor / max) * plotH : 0)
      return { x, y, label: p.label, valor: p.valor }
    }),
  }))

  function atualizarHover(clientX: number) {
    const svg = svgRef.current
    if (!svg || !labels.length) return
    const rect = svg.getBoundingClientRect()
    const xRel = ((clientX - rect.left) / rect.width) * LARGURA
    let nearest = 0
    let menorDist = Infinity
    seriesCoords[0].coords.forEach((c, i) => {
      const dist = Math.abs(c.x - xRel)
      if (dist < menorDist) {
        menorDist = dist
        nearest = i
      }
    })
    setHoverIdx(nearest)
  }

  const hoverX = hoverIdx !== null ? seriesCoords[0]?.coords[hoverIdx]?.x : null
  const gridValores = [0, max / 2, max]

  return (
    <div className="relative w-full">
      {multiSeries && (
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] mb-2">
          {todasSeries.map((s) => (
            <span key={s.nome} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-[2px] rounded" style={{ backgroundColor: s.cor }} />
              {s.nome}
            </span>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${LARGURA} ${altura}`}
        className="w-full"
        style={{ height: altura, display: 'block' }}
        onPointerMove={(e) => atualizarHover(e.clientX)}
        onPointerLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Gráfico de linha"
      >
        {gridValores.map((v, i) => {
          const y = PAD_TOP + plotH - (max > 0 ? (v / max) * plotH : 0)
          return (
            <line
              key={i}
              x1={PAD_X}
              x2={LARGURA - PAD_X}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth={1}
            />
          )
        })}

        {hoverX != null && (
          <line
            x1={hoverX}
            x2={hoverX}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
        )}

        {seriesCoords.map((s) => (
          <path
            key={s.nome}
            d={s.coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={s.cor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {seriesCoords.map((s) => (
          <g key={s.nome}>
            {s.coords.map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={hoverIdx === i ? 5 : 4}
                fill={s.cor}
                stroke="var(--bg-surface)"
                strokeWidth={2}
              />
            ))}
          </g>
        ))}

        {seriesCoords[0]?.coords.map((c, i) => (
          <text
            key={i}
            x={c.x}
            y={altura - 8}
            textAnchor="middle"
            fontSize={11}
            style={{ fill: 'var(--text-muted)' }}
          >
            {c.label}
          </text>
        ))}
      </svg>

      {hoverIdx !== null && hoverX != null && (
        <div
          className="absolute px-2 py-1 rounded-md text-xs border shadow-sm pointer-events-none whitespace-nowrap space-y-0.5"
          style={{
            left: `${(hoverX / LARGURA) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="text-[10px] text-[var(--text-muted)]">{labels[hoverIdx]}</div>
          {seriesCoords.map((s) => (
            <div key={s.nome} className="flex items-center gap-1.5">
              {multiSeries && <span className="inline-block w-2 h-[2px] rounded" style={{ backgroundColor: s.cor }} />}
              <span className="font-mono font-semibold" style={{ color: s.cor }}>
                {fmt(s.coords[hoverIdx]?.valor ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
