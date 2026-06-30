'use client'

import { useState, useEffect } from 'react'
import { FolderOpen, FileText, Copy, AlertTriangle, CheckCircle } from 'lucide-react'
import { Spinner } from '../ui/Spinner'
import type { BaseCSV, DriveFolder, DriveFile } from '@/types'

interface StepBaseDriveProps {
  base: BaseCSV
  onChange: (base: BaseCSV) => void
}

export function StepBaseDrive({ base, onChange }: StepBaseDriveProps) {
  const [pastas, setPastas] = useState<DriveFolder[]>([])
  const [pastaData, setPastaData] = useState<DriveFolder | null>(null)
  const [arquivos, setArquivos] = useState<Record<string, DriveFile[]>>({})
  const [loading, setLoading] = useState(true)
  const [carregandoPasta, setCarregandoPasta] = useState(false)
  const [popularStatus, setPopularStatus] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    async function carregar() {
      try {
        const res = await window.fetch('/api/drive/pastas')
        if (!res.ok) throw new Error('offline')
        const json = await res.json()
        setPastas(json.pastas ?? [])
        setOffline(false)
      } catch {
        setOffline(true)
        setPastas([])
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  async function selecionarPasta(pasta: DriveFolder) {
    setPastaData(pasta)
    setCarregandoPasta(true)
    setPopularStatus(null)

    try {
      const res = await window.fetch(`/api/drive/arquivos?folderId=${pasta.id}`)
      const json = await res.json()
      const subs: DriveFolder[] = json.subpastas ?? []

      const arqsPorSub: Record<string, DriveFile[]> = {}
      for (const sub of subs) {
        const subRes = await window.fetch(`/api/drive/arquivos?folderId=${sub.id}`)
        const subJson = await subRes.json()
        arqsPorSub[sub.nome] = subJson.arquivos ?? []
      }
      setArquivos(arqsPorSub)
    } catch {
      setArquivos({})
    } finally {
      setCarregandoPasta(false)
    }
  }

  async function handlePopular() {
    if (!pastaData) return
    setPopularStatus('copiando')
    try {
      const res = await window.fetch('/api/drive/popular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: pastaData.nome }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgs = (json.resultados ?? []).map((r: any) => `${r.tipo}: ${r.criados} arquivo(s)`).join(', ')
      setPopularStatus(`ok: ${msgs}`)
      selecionarPasta(pastaData)
    } catch (err) {
      setPopularStatus(`erro: ${(err as Error).message}`)
    }
  }

  async function selecionarArquivo(arq: DriveFile, nomeSub: string) {
    let totalRegistros: number | undefined

    try {
      const res = await window.fetch(`/api/drive/contar-linhas?fileId=${arq.id}`)
      if (res.ok) {
        const json = await res.json()
        if (typeof json.totalLinhas === 'number') {
          totalRegistros = json.totalLinhas
        }
      }
    } catch {
      // falha na contagem — segue sem totalRegistros
    }

    onChange({
      ...base,
      status: 'disponivel',
      driveFileId: arq.id,
      driveFolderId: pastaData?.id,
      driveFolderPath: `${pastaData?.nome}/${nomeSub}`,
      nomeArquivo: arq.nome,
      baixadoEm: new Date().toISOString(),
      totalRegistros,
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>
  }

  return (
    <div className="space-y-4">
      {offline && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--warning)15', border: '1px solid var(--warning)30', color: 'var(--warning)' }}>
          <AlertTriangle size={14} />
          Modo offline — Google Drive indisponível
        </div>
      )}

      {base.status === 'disponivel' && base.driveFileId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--success)15', border: '1px solid var(--success)30', color: 'var(--success)' }}>
          <CheckCircle size={14} />
          Base selecionada: {base.nomeArquivo} ({base.driveFolderPath})
        </div>
      )}

      {base.status === 'erro' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
          <AlertTriangle size={14} />
          {base.erro || 'Erro ao selecionar base'}
        </div>
      )}

      {!pastaData && (
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-2">Selecione a data da base</label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {pastas.map((p) => (
              <button
                key={p.id}
                onClick={() => selecionarPasta(p)}
                className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"
              >
                <FolderOpen size={14} className="text-[var(--d1)]" />
                {p.nome}
              </button>
            ))}
            {pastas.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] col-span-full py-4 text-center">
                Nenhuma pasta encontrada
              </p>
            )}
          </div>
        </div>
      )}

      {pastaData && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-[var(--d1)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">{pastaData.nome}</span>
              <button
                onClick={() => { setPastaData(null); setArquivos({}) }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
              >
                (trocar)
              </button>
            </div>
            <button
              onClick={handlePopular}
              disabled={popularStatus === 'copiando'}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <Copy size={12} />
              {popularStatus === 'copiando' ? 'Copiando...' : 'Copiar automático'}
            </button>
          </div>

          {popularStatus?.startsWith('ok') && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-3" style={{ backgroundColor: 'var(--success)15', border: '1px solid var(--success)30', color: 'var(--success)' }}>
              <CheckCircle size={14} />
              {popularStatus.slice(3)}
            </div>
          )}

          {popularStatus?.startsWith('erro') && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-3" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
              <AlertTriangle size={14} />
              {popularStatus.slice(5)}
            </div>
          )}

          {carregandoPasta && (
            <div className="flex justify-center py-8"><Spinner size={20} /></div>
          )}

          {!carregandoPasta && Object.entries(arquivos).map(([nomeSub, subs]) => (
              <div key={nomeSub} className="ml-2 mb-3">
                <div className="flex items-center gap-2 py-1 text-xs font-medium text-[var(--text-secondary)]">
                  <FolderOpen size={13} />
                  {nomeSub}
                  <span className="text-[var(--text-muted)] font-normal">({subs.length} CSVs)</span>
                </div>

                {subs.length === 0 && (
                  <p className="ml-5 text-[11px] text-[var(--text-muted)] py-1">Nenhum CSV disponível</p>
                )}

                {subs.map((arq) => (
                  <button
                    key={arq.id}
                    onClick={() => selecionarArquivo(arq, nomeSub)}
                    className={`ml-5 w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${
                      base.driveFileId === arq.id
                        ? 'bg-[var(--d1)]/10 text-[var(--d1)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <FileText size={12} />
                    <span>{arq.nome}</span>
                    <span className="text-[var(--text-muted)]">({(arq.tamanho / 1024).toFixed(0)} KB)</span>
                    {base.driveFileId === arq.id && <CheckCircle size={12} className="ml-auto" />}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
