'use client'

import { useState, useEffect } from 'react'
import { Phone, AlertTriangle } from 'lucide-react'
import { Spinner } from '../ui/Spinner'
import { Input } from '../ui/Input'
import type { NumeroSendpulse } from '@/types'

interface StepNumeroProps {
  numero?: NumeroSendpulse
  onChange: (numero?: NumeroSendpulse) => void
}

export function StepNumero({ numero, onChange }: StepNumeroProps) {
  const [numeros, setNumeros] = useState<NumeroSendpulse[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await window.fetch('/api/sendpulse/numeros')
        if (!res.ok) throw new Error('offline')
        const data = await res.json()
        setNumeros(data.numeros)
        setOffline(false)
      } catch {
        setOffline(true)
        setNumeros([
          { id: 'num_001', numero: '+5511999990000', chatbotId: 'chat_001', descricao: 'SB Receptivo ODD 100x' },
          { id: 'num_002', numero: '+5511999991111', chatbotId: 'chat_002', descricao: 'MGM Geral' },
          { id: 'num_003', numero: '+5511999992222', chatbotId: 'chat_003', descricao: 'Esportiva Bet VIP' },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>
  }

  return (
    <div className="space-y-4">
      {offline && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--warning)15', border: '1px solid var(--warning)30', color: 'var(--warning)' }}>
          <AlertTriangle size={14} />
          Modo offline — integração Sendpulse pendente
        </div>
      )}

      <div className="space-y-2">
        {numeros.map((num) => (
          <button
            key={num.id}
            onClick={() => { onChange(num); setManual(false) }}
            className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
              numero?.id === num.id
                ? 'border-[var(--d1)] bg-[var(--d1)]/5'
                : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
            }`}
          >
            <Phone size={16} className="text-[var(--text-muted)] flex-shrink-0" />
            <div>
              <span className="text-sm text-[var(--text-primary)]">{num.numero}</span>
              {num.descricao && (
                <p className="text-xs text-[var(--text-muted)]">{num.descricao}</p>
              )}
              <p className="text-xs text-[var(--text-muted)]">Chatbot: {num.chatbotId}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-muted)]">ou</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <button
        onClick={() => { setManual(!manual); if (!manual) onChange(undefined) }}
        className={`text-xs ${manual ? 'text-[var(--d1)]' : 'text-[var(--text-secondary)]'} hover:text-[var(--text-primary)]`}
      >
        {manual ? 'Usar lista de números' : 'Inserir número manualmente'}
      </button>

      {manual && (
        <div className="space-y-3">
          <Input
            label="Número"
            placeholder="+5511999990000"
            value={numero?.numero ?? ''}
            onChange={(e) => onChange({ id: crypto.randomUUID(), numero: e.target.value, chatbotId: numero?.chatbotId ?? '' })}
          />
          <Input
            label="Chatbot ID"
            placeholder="chat_001"
            value={numero?.chatbotId ?? ''}
            onChange={(e) => onChange({ id: crypto.randomUUID(), numero: numero?.numero ?? '', chatbotId: e.target.value })}
          />
          <Input
            label="Descrição (opcional)"
            placeholder="Ex: SB Receptivo"
            value={numero?.descricao ?? ''}
            onChange={(e) => onChange({ ...numero!, descricao: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
