'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, AlertTriangle, X, RotateCcw } from 'lucide-react'
import { useNotificacoes } from '@/hooks/useNotificacoes'

export function NotificacoesButton({ collapsed }: { collapsed: boolean }) {
  const { todas, ativas, dispensadas, naoLidas, dispensar, restaurar, dispensarTodas } = useNotificacoes()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [aberto])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className={`w-full flex items-center gap-3 h-9 rounded-md text-sm transition-colors ${
          aberto
            ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
        } ${collapsed ? 'lg:justify-center lg:px-0' : 'px-3'}`}
        title="Notificações"
      >
        <span className="relative flex-shrink-0">
          <Bell size={18} />
          {naoLidas > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--error)] text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </span>
        {!collapsed && <span className="flex-1 text-left">Notificações</span>}
      </button>

      {aberto && (
        <div className="absolute left-0 bottom-full mb-2 w-[300px] max-h-[60vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl z-50 p-2">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Notificações</span>
            {ativas.length > 0 && (
              <button
                onClick={dispensarTodas}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Dispensar todas
              </button>
            )}
          </div>

          {todas.length === 0 ? (
            <p className="px-1 py-4 text-xs text-[var(--text-muted)] text-center">Nada por aqui.</p>
          ) : (
            <div className="space-y-1">
              {todas.map((n) => {
                const off = dispensadas.has(n.id)
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2 px-2 py-2 rounded-md text-xs transition-opacity ${off ? 'opacity-40' : ''} ${
                      n.nivel === 'erro' ? 'bg-[var(--error)]/10' : 'bg-yellow-400/10'
                    }`}
                  >
                    <AlertTriangle
                      size={12}
                      className={`mt-0.5 shrink-0 ${n.nivel === 'erro' ? 'text-[var(--error)]' : 'text-yellow-500'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--text-primary)]">{n.titulo}</div>
                      <div className="text-[var(--text-muted)]">{n.texto}</div>
                    </div>
                    <button
                      onClick={() => (off ? restaurar(n.id) : dispensar(n.id))}
                      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title={off ? 'Restaurar' : 'Dispensar'}
                    >
                      {off ? <RotateCcw size={12} /> : <X size={12} />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
