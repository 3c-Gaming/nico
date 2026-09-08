'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, RefreshCw, Image as ImageIcon, CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { formatNumero, formatMoeda } from '@/lib/resultadoDisparo'
import { useResultadoDisparo } from '@/hooks/useResultadoDisparo'
import { FunilConversaoChart, type EstagioFunil } from '@/components/funis/FunilConversaoChart'
import { renderizarRcsContent } from '@/lib/rcs/template'
import { CUSTO_RCS_POR_ENVIO } from '@/lib/rcs/tipos'
import { RcsSuggestionChips } from './RcsSuggestionChips'
import type { Disparo } from '@/types'

const LARGURA = 440

interface EnvioRcs {
  telefone: string
  status: string
  clicado?: boolean
}

const FALHA = new Set(['erro', 'failed', 'undelivered'])
const ENTREGUE = new Set(['delivered', 'read', 'clicked'])

function corStatus(status: string): string {
  if (status === 'read') return 'text-violet-400'
  if (status === 'delivered') return 'text-emerald-400'
  if (FALHA.has(status)) return 'text-[var(--error)]'
  return 'text-[var(--text-secondary)]'
}

function Estatistica({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex-1 min-w-[80px] px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-base)]">
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{label}</div>
      <div className="text-base font-bold tabular-nums mt-0.5" style={{ color: cor ?? 'var(--text-primary)' }}>{valor}</div>
    </div>
  )
}

function PreviewRcs({ disparo }: { disparo: Disparo }) {
  const conteudo = disparo.rcsConteudo
  if (!conteudo) return <p className="text-[11px] text-[var(--text-muted)]">Sem conteúdo registrado.</p>
  const c = renderizarRcsContent(conteudo, {})
  const sugestoes = c.type === 'card' ? c.card.suggestions : c.suggestions

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-base)]">
      {c.type === 'card' ? (
        <>
          {c.card.media?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.card.media.url} alt="" className="w-full object-cover" style={{ maxHeight: 170 }} />
          ) : (
            <div className="h-16 flex items-center justify-center text-[var(--text-muted)]"><ImageIcon size={16} /></div>
          )}
          <div className="p-3 space-y-1">
            {c.card.title && <p className="text-sm font-semibold text-[var(--text-primary)]">{c.card.title}</p>}
            {c.card.description && <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{c.card.description}</p>}
          </div>
        </>
      ) : (
        <div className="p-3">
          <p className="text-xs text-[var(--text-primary)] whitespace-pre-wrap">{c.type === 'text' ? c.text : ''}</p>
        </div>
      )}
      <RcsSuggestionChips suggestions={sugestoes} />
    </div>
  )
}

export function PainelDetalheDisparoRcs({ disparo, onClose }: { disparo: Disparo | null; onClose: () => void }) {
  const [envios, setEnvios] = useState<EnvioRcs[]>([])
  const [atualizando, setAtualizando] = useState(false)
  const [carregou, setCarregou] = useState(false)

  const campanha = disparo?.nomenclatura

  // Fetch inicial + polling a cada 12s enquanto o painel está aberto. O GET só lê o que os
  // webhooks da Solvefy já gravaram (não bate na Solvefy), então é barato manter atualizado.
  useEffect(() => {
    if (!campanha) return
    let cancel = false
    const puxar = () => {
      fetch(`/api/rcs/status?campanha=${encodeURIComponent(campanha)}`)
        .then((r) => (r.ok ? r.json() : { envios: [] }))
        .then((data) => { if (!cancel) { setEnvios((data.envios ?? []) as EnvioRcs[]); setCarregou(true) } })
        .catch(() => { if (!cancel) setCarregou(true) })
    }
    puxar()
    const id = setInterval(puxar, 12_000)
    return () => { cancel = true; clearInterval(id) }
  }, [campanha])

  async function atualizarStatus() {
    if (!campanha) return
    setAtualizando(true)
    try {
      const res = await fetch('/api/rcs/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha }),
      })
      const data = await res.json()
      setEnvios((data.envios ?? []) as EnvioRcs[])
    } catch {
      /* noop */
    } finally {
      setAtualizando(false)
    }
  }

  const base = disparo?.base.totalRegistros ?? disparo?.rcsDestinatarios?.length ?? 0
  const enviados = envios.filter((e) => !FALHA.has(e.status)).length
  const entregues = envios.filter((e) => ENTREGUE.has(e.status)).length
  const lidas = envios.filter((e) => e.status === 'read' || e.status === 'clicked').length
  // conta tanto a flag `clicado` (webhook novo) quanto status legado 'clicked' (webhook antigo)
  const cliques = envios.filter((e) => e.clicado || e.status === 'clicked').length
  const falhas = envios.filter((e) => FALHA.has(e.status)).length

  // RCS é cobrado só pelo entregue — falha é reembolsada. Enquanto ninguém foi confirmado
  // como entregue, mostra o teto (base × custo) como estimativa.
  const custoUnit = disparo?.custoPorEnvio ?? CUSTO_RCS_POR_ENVIO
  const custoCobrado = entregues * custoUnit
  const custoEstimado = base * custoUnit

  // Resultado na casa (Reg/FTD/CPA) — mesma lógica do SMS: casa vem da UTM (Superbet) ou do
  // PID (BetMGM) gravado no disparo. Custo por unidade = o cobrado do RCS (só entregue).
  const casaAtiva: 'superbet' | 'betmgm' | null = disparo?.utm ? 'superbet' : disparo?.betmgmPid ? 'betmgm' : null
  const { resultado: tracking, carregando: carregandoTracking, custo: custoTracking } = useResultadoDisparo({
    utmValor: disparo?.utm || disparo?.betmgmPid,
    casa: casaAtiva,
    data: disparo?.dataDisparo,
    entregues,
    custoPorUnidade: custoUnit,
  })

  const estagios: EstagioFunil[] = disparo ? [
    { tag: 'Base', contagem: base },
    { tag: 'Enviados', contagem: enviados || envios.length },
    { tag: 'Entregues', contagem: entregues },
    { tag: 'Lidas', contagem: lidas },
    { tag: 'Cliques', contagem: cliques },
  ] : []

  return (
    <AnimatePresence>
      {disparo && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60" onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
            style={{ width: LARGURA }}
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate" title={disparo.nomenclatura}>
                    {disparo.nomenclatura}
                  </h2>
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-violet-500/15 text-violet-400">RCS</span>
                </div>
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
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Jornada da campanha</h3>
                  <button
                    onClick={atualizarStatus}
                    disabled={atualizando}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={atualizando ? 'animate-spin' : ''} />
                    {atualizando ? 'Consultando…' : 'Atualizar status'}
                  </button>
                </div>
                <FunilConversaoChart estagios={estagios} cor="#8b5cf6" orientacao="vertical" />
                {envios.length === 0 && carregou && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Nenhum envio registrado ainda pra essa campanha.
                  </p>
                )}
                {falhas > 0 && (
                  <p className="text-[11px] text-[var(--error)]">{falhas} envio(s) com falha.</p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Resultado na casa</h3>
                <div className="flex flex-wrap gap-2">
                  <Estatistica label="Registros" valor={carregandoTracking ? '…' : formatNumero(tracking?.registros ?? 0)} cor="var(--d1)" />
                  <Estatistica label="FTDs" valor={carregandoTracking ? '…' : formatNumero(tracking?.ftds ?? 0)} cor="#22c55e" />
                  <Estatistica label="CPAs" valor={carregandoTracking ? '…' : String(tracking?.cpas ?? 0)} cor="var(--warning)" />
                  <Estatistica label="Custo" valor={custoTracking > 0 ? formatMoeda(custoTracking) : '—'} cor="#34d399" />
                </div>
                {!casaAtiva && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Sem UTM/PID de casa vinculado — sem isso não dá pra calcular Reg/FTD/CPA. Configure na criação do disparo.
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Mensagem enviada</h3>
                <PreviewRcs disparo={disparo} />
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Detalhes</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[var(--text-muted)]">Base</div>
                    <div className="text-[var(--text-primary)]">{formatNumero(base)} número(s)</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)]">Custo cobrado</div>
                    <div className="text-[var(--text-primary)]">
                      R$ {custoCobrado.toFixed(2)}
                      <span className="text-[var(--text-muted)]"> ({entregues} entregue{entregues === 1 ? '' : 's'} × {custoUnit.toFixed(2)})</span>
                    </div>
                    {falhas > 0 && (
                      <div className="text-[10px] text-[var(--text-muted)]">{falhas} falha(s) — reembolsado, não cobra</div>
                    )}
                    {entregues === 0 && (
                      <div className="text-[10px] text-[var(--text-muted)]">estimado até R$ {custoEstimado.toFixed(2)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] flex items-center gap-1">
                      {disparo.status === 'agendado' && <CalendarClock size={10} />}
                      Data/Hora
                    </div>
                    <div className="text-[var(--text-primary)]">{disparo.dataDisparo} {disparo.horarioDisparo}</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)]">Entregues / Lidas / Cliques</div>
                    <div className="text-[var(--text-primary)]">{entregues} / {lidas} / {cliques}</div>
                  </div>
                  {casaAtiva && (
                    <div>
                      <div className="text-[var(--text-muted)]">UTM/PID ({casaAtiva === 'superbet' ? 'Superbet' : 'BetMGM'})</div>
                      <div className="font-mono text-[var(--text-primary)] truncate">{disparo.utm || disparo.betmgmPid}</div>
                    </div>
                  )}
                </div>
              </section>

              {envios.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Por número ({envios.length})</h3>
                  <div className="max-h-56 overflow-auto text-xs font-mono space-y-1">
                    {envios.map((e, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-[var(--text-secondary)]">{e.telefone}</span>
                        <span className="flex items-center gap-1.5">
                          {(e.clicado || e.status === 'clicked') && <span className="text-sky-400" title="Clicou">↗</span>}
                          <span className={corStatus(e.status)}>{e.status}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
