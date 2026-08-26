'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X, MessageSquare, Send, Link as LinkIcon, CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { useResultadoDisparo } from '@/hooks/useResultadoDisparo'
import { formatMoeda, formatNumero } from '@/lib/resultadoDisparo'
import { FunilConversaoChart, type EstagioFunil } from '@/components/funis/FunilConversaoChart'
import type { Disparo } from '@/types'

const LARGURA = 440

export interface ResumoCampanhaSms {
  total: number
  enviados: number
  entregues: number
  clicados: number
  falhas: number
}

function Estatistica({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex-1 min-w-[90px] px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5" style={{ color: cor ?? 'var(--text-primary)' }}>{valor}</div>
    </div>
  )
}

export function PainelDetalheDisparoSms({ disparo, resumoSms, onClose }: { disparo: Disparo | null; resumoSms?: ResumoCampanhaSms; onClose: () => void }) {
  const casaAtiva: 'superbet' | 'betmgm' | null = disparo?.utm ? 'superbet' : disparo?.betmgmPid ? 'betmgm' : null
  const { resultado, carregando, custo } = useResultadoDisparo({
    utmValor: disparo?.utm || disparo?.betmgmPid,
    casa: casaAtiva,
    data: disparo?.dataDisparo,
    entregues: disparo?.base.totalRegistros,
    custoPorUnidade: disparo?.custoPorEnvio,
  })

  const estagios: EstagioFunil[] = disparo ? [
    { tag: 'Base', contagem: disparo.base.totalRegistros ?? 0 },
    { tag: 'Enviados', contagem: resumoSms?.enviados ?? 0 },
    { tag: 'Entregues', contagem: resumoSms?.entregues ?? 0 },
    { tag: 'Clicados', contagem: resumoSms?.clicados ?? 0 },
  ] : []

  return (
    <AnimatePresence>
      {disparo && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
            style={{ width: LARGURA }}
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate" title={disparo.nomenclatura}>
                  {disparo.nomenclatura}
                </h2>
                <span className="inline-flex items-center gap-1.5 mt-1">
                  <StatusDot status={disparo.status} size={7} />
                  <Badge variant="status" value={disparo.status} />
                </span>
              </div>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Jornada da campanha</h3>
                <FunilConversaoChart estagios={estagios} cor="var(--d1)" orientacao="vertical" />
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Resultado na casa</h3>
                <div className="flex flex-wrap gap-2">
                  <Estatistica label="Registros" valor={carregando ? '…' : formatNumero(resultado?.registros ?? 0)} cor="var(--d1)" />
                  <Estatistica label="FTDs" valor={carregando ? '…' : formatNumero(resultado?.ftds ?? 0)} cor="#22c55e" />
                  <Estatistica label="CPAs" valor={carregando ? '…' : String(resultado?.cpas ?? 0)} cor="var(--warning)" />
                  <Estatistica label="Custo" valor={custo > 0 ? formatMoeda(custo) : '—'} cor="#34d399" />
                </div>
                {!casaAtiva && (
                  <p className="text-[11px] text-[var(--text-muted)]">Essa campanha não tem UTM/PID de casa vinculado — sem isso não dá pra calcular Reg/FTD/CPA.</p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Mensagem enviada</h3>
                <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <Send size={11} />
                    De: <span className="font-mono text-[var(--text-secondary)]">{disparo.smsFrom || '—'}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-sm text-[var(--text-primary)]">
                    <MessageSquare size={13} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                    <span className="whitespace-pre-wrap break-words">{disparo.smsCorpo || 'Sem corpo registrado.'}</span>
                  </div>
                  {disparo.smsUseShortener && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--d3)]">
                      <LinkIcon size={11} />
                      Link encurtado com rastreio de clique ativado
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Detalhes</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[var(--text-muted)]">UTM/PID</div>
                    <div className="font-mono text-[var(--text-primary)]">{disparo.utm || disparo.betmgmPid || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)]">Base</div>
                    <div className="text-[var(--text-primary)]">{formatNumero(disparo.base.totalRegistros ?? 0)} número(s)</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] flex items-center gap-1">
                      {disparo.status === 'agendado' && <CalendarClock size={10} />}
                      Data/Hora
                    </div>
                    <div className="text-[var(--text-primary)]">{disparo.dataDisparo} {disparo.horarioDisparo}</div>
                  </div>
                  {resumoSms && (
                    <div>
                      <div className="text-[var(--text-muted)]">Falhas de envio</div>
                      <div className={resumoSms.falhas > 0 ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}>{resumoSms.falhas}</div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
