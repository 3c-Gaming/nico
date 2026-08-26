'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Pin, ExternalLink, CalendarClock } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { useDisparos } from '@/hooks/useDisparos'
import { usePinnedDisparos } from '@/hooks/usePinnedDisparos'
import { useResultadoDisparo } from '@/hooks/useResultadoDisparo'
import { formatMoeda, formatNumero } from '@/lib/resultadoDisparo'
import { PainelDetalheDisparoSms, type ResumoCampanhaSms } from '@/components/disparos/PainelDetalheDisparoSms'
import type { Disparo } from '@/types'

function CampanhaRow({ disparo, resumoSms, onVerDetalhes }: { disparo: Disparo; resumoSms?: ResumoCampanhaSms; onVerDetalhes: (disparo: Disparo) => void }) {
  const { toggle: togglePin, isPinned } = usePinnedDisparos()
  const casaAtiva: 'superbet' | 'betmgm' | null = disparo.utm ? 'superbet' : disparo.betmgmPid ? 'betmgm' : null
  const { resultado, carregando, custo } = useResultadoDisparo({
    utmValor: disparo.utm || disparo.betmgmPid,
    casa: casaAtiva,
    data: disparo.dataDisparo,
    entregues: disparo.base.totalRegistros,
    custoPorUnidade: disparo.custoPorEnvio,
  })

  return (
    <tr
      className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50 transition-colors cursor-pointer"
      onClick={() => onVerDetalhes(disparo)}
    >
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); togglePin(disparo.id) }}
            className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-elevated)] transition-colors"
            title={isPinned(disparo.id) ? 'Desafixar da Home' : 'Fixar na Home'}
          >
            <Pin size={12} className={isPinned(disparo.id) ? 'text-amber-400' : 'text-[var(--text-muted)]'} />
          </button>
          <span className="font-medium text-[var(--text-primary)] max-w-[220px] truncate" title={disparo.nomenclatura}>
            {disparo.nomenclatura}
          </span>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={disparo.status} size={7} />
          <Badge variant="status" value={disparo.status} />
        </span>
      </td>
      <td className="py-3 px-3 text-xs text-[var(--text-secondary)] font-mono">
        {disparo.utm || disparo.betmgmPid || <span className="text-[var(--text-muted)]">—</span>}
      </td>
      <td className="py-3 px-3 text-right font-mono text-[var(--text-primary)]">{formatNumero(disparo.base.totalRegistros ?? 0)}</td>
      <td className="py-3 px-3 text-right font-mono text-[var(--text-secondary)]">{resumoSms ? formatNumero(resumoSms.enviados) : '—'}</td>
      <td className="py-3 px-3 text-right font-mono text-sky-400">{resumoSms ? formatNumero(resumoSms.entregues) : '—'}</td>
      <td className="py-3 px-3 text-right font-mono text-violet-400">{resumoSms ? formatNumero(resumoSms.clicados) : '—'}</td>
      <td className="py-3 px-3 text-right font-mono text-emerald-400">{custo > 0 ? formatMoeda(custo) : '—'}</td>
      <td className="py-3 px-3 text-right font-mono text-[var(--d1)]">{carregando ? '…' : (resultado ? formatNumero(resultado.registros) : '—')}</td>
      <td className="py-3 px-3 text-right font-mono text-green-500">{carregando ? '…' : (resultado ? formatNumero(resultado.ftds) : '—')}</td>
      <td className="py-3 px-3 text-right font-mono text-[var(--warning)]">{carregando ? '…' : (resultado?.cpas ?? '—')}</td>
      <td className="py-3 px-3 text-[var(--text-muted)] text-xs whitespace-nowrap">
        {disparo.status === 'agendado' && <CalendarClock size={11} className="inline-block mr-1 -mt-0.5" />}
        {disparo.dataDisparo} {disparo.horarioDisparo}
      </td>
      <td className="py-3 px-3 text-center">
        <button
          onClick={(e) => { e.stopPropagation(); onVerDetalhes(disparo) }}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mx-auto"
          title="Ver detalhes"
        >
          <ExternalLink size={14} />
        </button>
      </td>
    </tr>
  )
}

export default function DisparosPage() {
  const router = useRouter()
  const { list: todosDisparos } = useDisparos()
  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [resumoSms, setResumoSms] = useState<Record<string, ResumoCampanhaSms>>({})
  const [disparoSelecionado, setDisparoSelecionado] = useState<Disparo | null>(null)

  useEffect(() => {
    fetch('/api/sms/resumo')
      .then((r) => r.ok ? r.json() : { resumo: {} })
      .then((json) => setResumoSms(json.resumo ?? {}))
      .catch(() => {})
  }, [])

  const campanhasSms = useMemo(
    () => todosDisparos
      .filter((d) => d.canal === 'sms')
      .sort((a, b) => `${b.dataDisparo}T${b.horarioDisparo}`.localeCompare(`${a.dataDisparo}T${a.horarioDisparo}`)),
    [todosDisparos],
  )

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    return campanhasSms.filter((c) => {
      if (termo && !c.nomenclatura.toLowerCase().includes(termo)) return false
      if (dataInicio && c.dataDisparo < dataInicio) return false
      if (dataFim && c.dataDisparo > dataFim) return false
      return true
    })
  }, [campanhasSms, dataInicio, dataFim, busca])

  return (
    <>
      <PageHeader
        titulo="Disparos"
        descricao="Campanhas de SMS disparadas e agendadas"
        acoes={
          <button
            onClick={() => router.push('/disparos/sms-rapido')}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white transition-colors hover:brightness-110"
            style={{ backgroundColor: 'var(--d1)' }}
          >
            <Plus size={14} />
            Disparo SMS
          </button>
        }
      />

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus:border-[var(--d3)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-muted)]">De</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-2 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-muted)]">Até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-2 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none"
            />
          </div>
          <span className="text-xs text-[var(--text-muted)] ml-auto">{filtradas.length} de {campanhasSms.length} campanha(s)</span>
        </div>

        {campanhasSms.length === 0 ? (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhuma campanha de SMS ainda — clique em &quot;Disparo SMS&quot; pra criar a primeira.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Nome</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">UTM/PID</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Base</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Enviados</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Entregues</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Clicados</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Custo</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Reg</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">FTDs</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-[var(--text-muted)]">CPAs</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)]">Data/Hora</th>
                  <th className="py-3 px-3 text-xs font-medium text-[var(--text-muted)]"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => (
                  <CampanhaRow key={c.id} disparo={c} resumoSms={resumoSms[c.nomenclatura]} onVerDetalhes={setDisparoSelecionado} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PainelDetalheDisparoSms
        disparo={disparoSelecionado}
        resumoSms={disparoSelecionado ? resumoSms[disparoSelecionado.nomenclatura] : undefined}
        onClose={() => setDisparoSelecionado(null)}
      />
    </>
  )
}
