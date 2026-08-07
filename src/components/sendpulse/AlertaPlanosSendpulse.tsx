'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { StatusPlanoSendpulse } from '@/lib/integrações/sendpulse'

const LIMIAR_DIAS = 5

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function diasParaExpirar(expiredAt: string): number {
  return Math.ceil((new Date(expiredAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

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

  const expirados = planos.filter((p) => p.isExpired)
  const expirandoLogo = planos.filter(
    (p) => !p.isExpired && p.expiredAt && diasParaExpirar(p.expiredAt) <= LIMIAR_DIAS,
  )

  if (!expirados.length && !expirandoLogo.length) return null

  return (
    <div className="space-y-2">
      {expirados.map((p) => (
        <div
          key={p.contaId}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs"
          style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            <strong>Plano da SendPulse expirado</strong> — {p.contaNome}
            {p.tariffCode ? ` (${p.tariffCode})` : ''} expirou em {p.expiredAt ? formatarData(p.expiredAt) : '—'}.
          </span>
        </div>
      ))}
      {expirandoLogo.map((p) => (
        <div
          key={p.contaId}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs"
          style={{ backgroundColor: 'var(--warning)15', border: '1px solid var(--warning)30', color: 'var(--warning)' }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            <strong>Plano da SendPulse expirando</strong> — {p.contaNome}
            {p.tariffCode ? ` (${p.tariffCode})` : ''} expira em {diasParaExpirar(p.expiredAt!)} dia(s) ({formatarData(p.expiredAt!)}).
          </span>
        </div>
      ))}
    </div>
  )
}
