'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useNotificacoes } from '@/hooks/useNotificacoes'

/** Faixa amarela no topo do app inteiro (ver ClientLayout), acima até do título da página atual —
 * plano da SendPulse expirado/expirando é o tipo de coisa que não pode passar despercebido.
 * Cada aviso pode ser dispensado no X; o histórico fica no botão "Notificações" da sidebar. */
export function AlertaPlanosSendpulse() {
  const { ativas, dispensar } = useNotificacoes()

  if (!ativas.length) return null

  return (
    <div className="bg-yellow-400 text-black divide-y divide-black/10">
      {ativas.map((n) => (
        <div key={n.id} className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium">
          <AlertTriangle size={13} className="shrink-0" />
          <span className="flex-1">
            <strong>{n.titulo}</strong> — {n.texto}
          </span>
          <button
            onClick={() => dispensar(n.id)}
            className="shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
            title="Dispensar"
            aria-label="Dispensar aviso"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
