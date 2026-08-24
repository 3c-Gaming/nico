'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { StatusPlanoSendpulse } from '@/lib/integrações/sendpulse'
import { classificarPlanosSendpulse } from '@/lib/sendpulsePlanos'
import { diasAte } from '@/lib/datas'

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/** Faixa amarela no topo do app inteiro (ver ClientLayout), acima até do título da página atual —
 * plano da SendPulse expirado/expirando é o tipo de coisa que não pode passar despercebido
 * enfiado no meio do conteúdo de uma tela só. */
export function AlertaPlanosSendpulse() {
  const [planos, setPlanos] = useState<StatusPlanoSendpulse[]>([])

  useEffect(() => {
    let cancelado = false
    fetch('/api/sendpulse/planos')
      .then((r) => (r.ok ? r.json() : { planos: [] }))
      .then((json) => { if (!cancelado) setPlanos(json.planos ?? []) })
      .catch(() => {})
    return () => { cancelado = true }
  }, [])

  const { expirados, expirando: expirandoLogo } = classificarPlanosSendpulse(planos)
  const avisos = [...expirados, ...expirandoLogo]

  if (!avisos.length) return null

  return (
    <div className="bg-yellow-400 text-black divide-y divide-black/10">
      {expirados.map((p) => (
        <div key={p.contaId} className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            <strong>Plano da SendPulse expirado</strong> — {p.contaNome}
            {p.tariffCode ? ` (${p.tariffCode})` : ''} expirou em {p.expiredAt ? formatarData(p.expiredAt) : '—'}.
          </span>
        </div>
      ))}
      {expirandoLogo.map((p) => (
        <div key={p.contaId} className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            <strong>Plano da SendPulse expirando</strong> — {p.contaNome}
            {p.tariffCode ? ` (${p.tariffCode})` : ''} expira em {diasAte(p.expiredAt!)} dia(s) ({formatarData(p.expiredAt!)}).
          </span>
        </div>
      ))}
    </div>
  )
}
