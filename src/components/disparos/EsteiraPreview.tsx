'use client'

import { useMemo } from 'react'
import type { CasaAposta, EsteiraEtapaConfig } from '@/types'
import { calcularDataFilho, DEFAULT_CONFIGS } from '@/lib/esteira'
import { formatarData } from '@/lib/datas'
import { useEtapaConfigs } from '@/hooks/useEtapaConfigs'

interface EsteiraPreviewProps {
  dataDisparo: string
  casas: CasaAposta[]
  horario: string
}

export function EsteiraPreview({ dataDisparo, casas, horario }: EsteiraPreviewProps) {
  const { configs } = useEtapaConfigs()
  const previa = useMemo(() => {
    const [ano, mes, dia] = dataDisparo.split('-').map(Number)
    const dataD1 = new Date(ano, mes - 1, dia)
    const cfgs: EsteiraEtapaConfig[] = configs.length > 0 ? configs : DEFAULT_CONFIGS

    return cfgs.map((cfg) => ({
      tipo: cfg.tipo,
      data: calcularDataFilho(dataD1, cfg.offsetDias),
    }))
  }, [dataDisparo, configs])

  if (!dataDisparo || casas.length === 0) return null

  return (
    <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-4">
      <span className="text-xs text-[var(--text-secondary)] font-medium mb-3 block">
        Prévia da Esteira
      </span>
      <div className="flex items-start gap-0">
        {previa.map((item, i) => (
          <div key={item.tipo} className="flex items-start flex-1">
            <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `var(--${item.tipo === 'D1' ? 'd1' : item.tipo === 'D3' ? 'd3' : item.tipo === 'D5' ? 'd5' : 'd7'})20`,
                  color: `var(--${item.tipo === 'D1' ? 'd1' : item.tipo === 'D3' ? 'd3' : item.tipo === 'D5' ? 'd5' : 'd7'})`,
                }}
              >
                {item.tipo}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                {formatarData(item.data, 'DD/MM')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">{horario}</span>
            </div>
            {i < 3 && (
              <div className="flex items-center pt-3 px-1">
                <div className="w-4 h-px bg-[var(--border-strong)]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
