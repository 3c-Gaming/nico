'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Input } from '../ui/Input'
import type { TemplateDaxx } from '@/types'

interface StepTemplateProps {
  template?: TemplateDaxx
  onChange: (template?: TemplateDaxx) => void
}

export function StepTemplate({ template, onChange }: StepTemplateProps) {
  const [templates, setTemplates] = useState<TemplateDaxx[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await window.fetch('/api/daxx/templates')
        if (!res.ok) throw new Error('offline')
        const data = await res.json()
        setTemplates(data.templates)
        setOffline(false)
      } catch {
        setOffline(true)
        setTemplates([
          { id: 'tpl_001', nome: 'Template ODD 100x', url: 'https://daxx.example.com/tpl/001', descricao: 'Template para ODD com 100x de odds' },
          { id: 'tpl_002', nome: 'Template Promo Geral', url: 'https://daxx.example.com/tpl/002', descricao: 'Template promocional genérico' },
          { id: 'tpl_003', nome: 'Template Esportivas', url: 'https://daxx.example.com/tpl/003', descricao: 'Template para campanhas esportivas' },
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
          Modo offline — integração DAXX pendente
        </div>
      )}

      <div className="space-y-2">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => { onChange(tpl); setManual(false) }}
            className={`w-full flex items-center justify-between p-3 rounded-md border text-left transition-colors ${
              template?.id === tpl.id
                ? 'border-[var(--d1)] bg-[var(--d1)]/5'
                : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div>
              <span className="text-sm text-[var(--text-primary)]">{tpl.nome}</span>
              {tpl.descricao && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{tpl.descricao}</p>
              )}
            </div>
            {tpl.url && (
              <a
                href={tpl.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Ver destino <ExternalLink size={12} />
              </a>
            )}
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
        {manual ? 'Usar lista de templates' : 'Inserir template manualmente'}
      </button>

      {manual && (
        <div className="space-y-3">
          <Input
            label="ID do Template"
            placeholder="Ex: tpl_001"
            value={template?.id ?? ''}
            onChange={(e) => onChange({ id: e.target.value, nome: e.target.value })}
          />
          <Input
            label="URL do Template (opcional)"
            placeholder="https://..."
            value={template?.url ?? ''}
            onChange={(e) => onChange({ ...template, id: template?.id ?? crypto.randomUUID(), nome: template?.nome ?? '', url: e.target.value } as TemplateDaxx)}
          />
        </div>
      )}
    </div>
  )
}
