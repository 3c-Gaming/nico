'use client'

import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { BarraComparativa } from '../BarraComparativa'
import { CORES_CASA, formatarMoeda, formatarNumero } from '../formato'
import { porCasaComFunisWhatsapp } from '@/lib/resultados/funisWhatsapp'
import { estaOculto } from '../elementosOcultaveis'
import { subtituloCustom } from '../textosSlide'

export function SlidePorCasa({ dados, topicos }: { dados: ResultadosJunho2026; topicos?: TopicosResultado }) {
  // FTDs por casa = disparos + funis de WhatsApp (só reg/FTD; lucro/ROI seguem só dos disparos)
  const porCasa = porCasaComFunisWhatsapp(dados)
  const casas = Object.entries(porCasa).sort((a, b) => b[1].ftd - a[1].ftd || b[1].lucro - a[1].lucro)
  const [melhorCasa] = casas[0] ?? ['—']

  return (
    <SlideShell
      eyebrow="Resultados Por casa"
      titulo={`${melhorCasa} como foco para FTD`}
      subtitulo={subtituloCustom(topicos, 'por-casa') ?? 'FTDs por casa somando disparos e funis de WhatsApp'}
    >
      {!estaOculto(topicos, 'porCasa.barras') && (
        <SlideItem className="w-full">
          <BarraComparativa
            itens={casas.map(([casa, agg]) => ({
              label: casa,
              valor: agg.ftd,
              cor: CORES_CASA[casa] ?? 'var(--success)',
              destaque: `${formatarNumero(agg.ftd)} FTDs${agg.lucro !== 0 ? ` · ${formatarMoeda(agg.lucro)}` : ''}`,
            }))}
          />
        </SlideItem>
      )}

      <SlideItem className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
        {casas.map(([casa, agg]) => (
          <div
            key={casa}
            className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-2.5 sm:p-4 text-left"
            style={{ borderLeft: `3px solid ${CORES_CASA[casa] ?? 'var(--d1)'}` }}
          >
            <div className="text-sm font-bold mb-2" style={{ color: CORES_CASA[casa] ?? 'var(--d1)' }}>
              {casa}
            </div>
            <div className="text-[11px] sm:text-xs text-[var(--text-primary)] space-y-1">
              {agg.disparos > 0 ? (
                <>
                  <div>{agg.disparos} Disparos Efetuados</div>
                  <div>{agg.entregues.toLocaleString('pt-BR')} Mensagens entregues</div>
                  <div style={agg.roas < 1 ? { color: 'var(--error)' } : undefined}>ROI {agg.roas.toFixed(2)}x</div>
                </>
              ) : (
                <div className="text-[var(--text-muted)]">Somente funil de WhatsApp (sem disparo no mês)</div>
              )}
              <div className="grid grid-cols-3 gap-1 sm:gap-2 border border-[var(--glass-border)] rounded">
                <div className="p-1.5 sm:p-4 text-center">
                  <b>{agg.registros}</b>
                  <p>REG</p>
                </div>
                <div className="p-1.5 sm:p-4 text-center">
                  <b>{agg.ftd}</b>
                  <p>FTDs</p>
                </div>
                <div className="p-1.5 sm:p-4 text-center">
                  <b>{agg.cpas}</b>
                  <p>CPAs</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </SlideItem>
    </SlideShell>
  )
}
