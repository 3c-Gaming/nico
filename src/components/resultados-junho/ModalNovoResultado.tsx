'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Upload } from 'lucide-react'
import type { Resultado } from '@/types'

interface ModalNovoResultadoProps {
  open: boolean
  onClose: () => void
  onCriado: (resultado: Resultado) => void
}

export function ModalNovoResultado({ open, onClose, onCriado }: ModalNovoResultadoProps) {
  const [titulo, setTitulo] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function reset() {
    setTitulo('')
    setPeriodoInicio('')
    setPeriodoFim('')
    setFile(null)
    setErro(null)
  }

  function handleClose() {
    if (enviando) return
    reset()
    onClose()
  }

  async function handleEnviar() {
    if (!titulo.trim() || !periodoInicio.trim() || !periodoFim.trim() || !file) return
    setEnviando(true)
    setErro(null)
    try {
      const formData = new FormData()
      formData.append('titulo', titulo.trim())
      formData.append('periodoInicio', periodoInicio.trim())
      formData.append('periodoFim', periodoFim.trim())
      formData.append('file', file)

      const res = await fetch('/api/resultados', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao processar CSV')

      onCriado(data.resultado as Resultado)
      reset()
      onClose()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Novo Resultado" width="480px">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Julho 2026"
            className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Período início</label>
            <input
              type="text"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              placeholder="01/07"
              className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Período fim</label>
            <input
              type="text"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              placeholder="31/07"
              className="w-full h-8 px-3 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">CSV de disparos</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-[var(--text-primary)] file:mr-3 file:h-8 file:px-3 file:rounded file:border-0 file:bg-[var(--bg-elevated)] file:text-[var(--text-primary)] file:text-xs"
          />
        </div>

        {erro && <p className="text-xs text-[var(--error)]">{erro}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-[var(--border)]">
        <Button variant="secondary" size="sm" onClick={handleClose} disabled={enviando}>Cancelar</Button>
        <Button
          size="sm"
          icon={<Upload size={14} />}
          onClick={handleEnviar}
          loading={enviando}
          disabled={!titulo.trim() || !periodoInicio.trim() || !periodoFim.trim() || !file}
        >
          Processar CSV
        </Button>
      </div>
    </Modal>
  )
}
