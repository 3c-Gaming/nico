'use client'

import { useState, useEffect } from 'react'
import { Download, Database, AlertTriangle, CheckCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import type { BaseCSV } from '@/types'

interface StepCSVProps {
  base: BaseCSV
  onChange: (base: BaseCSV) => void
}

export function StepCSV({ base, onChange }: StepCSVProps) {
  const [bases, setBases] = useState<{ id: string; nome: string; totalRegistros: number; criadoEm: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [baixando, setBaixando] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await window.fetch('/api/leadhub/bases')
        if (!res.ok) throw new Error('offline')
        const data = await res.json()
        setBases(data.bases)
        setOffline(false)
      } catch {
        setOffline(true)
        setBases([
          { id: 'base_001', nome: 'Base SuperBet Junho 2026', totalRegistros: 4821, criadoEm: '2026-06-15' },
          { id: 'base_002', nome: 'Base BetMGM Julho 2026', totalRegistros: 2150, criadoEm: '2026-06-18' },
          { id: 'base_003', nome: 'Base EsportivaBet Promo', totalRegistros: 3100, criadoEm: '2026-06-20' },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  async function handleDownload(baseId: string, nome: string) {
    setBaixando(true)
    onChange({ ...base, status: 'baixando' })
    try {
      const res = await window.fetch('/api/leadhub/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseId }),
      })
      const data = await res.json()
      onChange({
        leadhubId: baseId,
        nomeArquivo: nome,
        totalRegistros: data.totalRegistros,
        status: 'disponivel',
        caminhoLocal: data.caminhoLocal,
        baixadoEm: new Date().toISOString(),
      })
    } catch {
      onChange({
        leadhubId: baseId,
        nomeArquivo: nome,
        status: 'erro',
        erro: 'Falha ao baixar base',
      })
    } finally {
      setBaixando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {offline && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--warning)15', border: '1px solid var(--warning)30', color: 'var(--warning)' }}>
          <AlertTriangle size={14} />
          Modo offline — integração LeadHub pendente
        </div>
      )}

      {base.status === 'disponivel' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--success)15', border: '1px solid var(--success)30', color: 'var(--success)' }}>
          <CheckCircle size={14} />
          Base disponível: {base.nomeArquivo} ({base.totalRegistros} registros)
        </div>
      )}

      {base.status === 'erro' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
          <AlertTriangle size={14} />
          {base.erro || 'Erro ao baixar base'}
        </div>
      )}

      <div className="space-y-2">
        {bases.map((b) => (
          <div
            key={b.id}
            className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
              base.leadhubId === b.id
                ? 'border-[var(--d1)] bg-[var(--d1)]/5'
                : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Database size={16} className="text-[var(--text-muted)]" />
              <div>
                <span className="text-sm text-[var(--text-primary)]">{b.nome}</span>
                <div className="text-xs text-[var(--text-muted)]">
                  {b.totalRegistros} registros · {b.criadoEm}
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={baixando && base.leadhubId === b.id}
              onClick={() => handleDownload(b.id, b.nome)}
              icon={<Download size={14} />}
            >
              Baixar
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
