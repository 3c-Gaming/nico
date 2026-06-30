'use client'

import { useState, useEffect } from 'react'
import { Phone, AlertTriangle, Wifi, WifiOff, Check } from 'lucide-react'
import { Spinner } from '../ui/Spinner'
import { Input } from '../ui/Input'
import type { NumeroSendpulse } from '@/types'

function StatusNumero({ status, inboxNaoLidas }: { status: NumeroSendpulse['status']; inboxNaoLidas: number }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${status === 'ativo' ? 'text-green-500' : 'text-red-400'}`}>
      {status === 'ativo' ? <Wifi size={10} /> : <WifiOff size={10} />}
      {status === 'ativo' ? 'Ativo' : 'Inativo'}
      {inboxNaoLidas > 0 && (
        <span className="ml-1 px-1 py-0.5 rounded-full text-[10px] leading-none font-medium bg-[var(--d1)]/20 text-[var(--d1)]">
          {inboxNaoLidas} não lida(s)
        </span>
      )}
    </span>
  )
}

interface StepNumeroProps {
  numeros: NumeroSendpulse[]
  onChange: (numeros: NumeroSendpulse[]) => void
}

export function StepNumero({ numeros: selected, onChange }: StepNumeroProps) {
  const [numeros, setNumeros] = useState<NumeroSendpulse[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [manual, setManual] = useState(false)
  const [manualInput, setManualInput] = useState('')

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
          { id: 'num_001', numero: '+5511999990000', nome: 'SB Receptivo ODD 100x', status: 'ativo', inboxTotal: 0, inboxNaoLidas: 0 },
          { id: 'num_002', numero: '+5511999991111', nome: 'MGM Geral', status: 'ativo', inboxTotal: 0, inboxNaoLidas: 0 },
          { id: 'num_003', numero: '+5511999992222', nome: 'Esportiva Bet VIP', status: 'ativo', inboxTotal: 0, inboxNaoLidas: 0 },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  function toggleNumero(num: NumeroSendpulse) {
    const idx = selected.findIndex((n) => n.id === num.id)
    if (idx >= 0) {
      onChange(selected.filter((_, i) => i !== idx))
    } else {
      onChange([...selected, num])
    }
  }

  function addManual() {
    const val = manualInput.trim()
    if (!val) return
    const novo: NumeroSendpulse = {
      id: crypto.randomUUID(),
      numero: val,
      nome: '',
      status: 'inativo',
      inboxTotal: 0,
      inboxNaoLidas: 0,
    }
    onChange([...selected, novo])
    setManualInput('')
  }

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

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((n) => (
            <span
              key={n.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-[var(--d1)]/10 border border-[var(--d1)]/30 text-[var(--d1)]"
            >
              {n.numero}
              <button onClick={() => toggleNumero(n)} className="hover:text-[var(--error)] transition-colors">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {numeros.map((num) => {
          const ativo = selected.some((n) => n.id === num.id)
          return (
            <button
              key={num.id}
              onClick={() => toggleNumero(num)}
              className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
                ativo
                  ? 'border-[var(--d1)] bg-[var(--d1)]/5'
                  : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                ativo
                  ? 'bg-[var(--d1)] border-[var(--d1)] text-white'
                  : 'border-[var(--border)]'
              }`}>
                {ativo && <Check size={10} />}
              </span>
              <Phone size={16} className="text-[var(--text-muted)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-primary)] font-medium truncate">{num.nome}</span>
                  <StatusNumero status={num.status} inboxNaoLidas={num.inboxNaoLidas} />
                </div>
                <p className="text-xs text-[var(--text-muted)]">{num.numero}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-muted)]">ou</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <button
        onClick={() => setManual(!manual)}
        className={`text-xs ${manual ? 'text-[var(--d1)]' : 'text-[var(--text-secondary)]'} hover:text-[var(--text-primary)]`}
      >
        {manual ? 'Usar lista de números' : 'Inserir número manualmente'}
      </button>

      {manual && (
        <div className="flex items-center gap-2">
          <Input
            label="Número"
            placeholder="+5511999990000"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
          />
          <button
            onClick={addManual}
            disabled={!manualInput.trim()}
            className="self-end h-8 px-3 rounded text-xs font-medium text-white bg-[var(--d1)] disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
      )}
    </div>
  )
}
