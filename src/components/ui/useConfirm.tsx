'use client'

import { useCallback, useRef, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmOpts {
  titulo?: string
  mensagem: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

/**
 * Confirmação nativa do app no lugar do `window.confirm`. Uso:
 *   const { confirm, dialog } = useConfirm()
 *   ...
 *   if (!(await confirm({ mensagem: 'Enviar agora?' }))) return
 *   ...
 *   return <>{dialog}{restante da tela}</>
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOpts) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const fechar = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }, [])

  const dialog = opts ? (
    <Modal open onClose={() => fechar(false)} title={opts.titulo ?? 'Confirmar'} width="420px">
      <div className="space-y-4">
        <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{opts.mensagem}</div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => fechar(false)}>
            {opts.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button size="sm" variant={opts.danger ? 'danger' : 'primary'} onClick={() => fechar(true)}>
            {opts.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      </div>
    </Modal>
  ) : null

  return { confirm, dialog }
}
