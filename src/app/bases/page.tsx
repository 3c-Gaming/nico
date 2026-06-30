'use client'

import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, FileText, Plus, Copy, RefreshCw, Download, ChevronRight, ChevronDown, AlertTriangle, CheckCircle, Upload, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import type { DriveFolder, DriveFile, CasaAposta, TipoDisparo } from '@/types'
import { getState, setState } from '@/lib/store'

interface PastaComConteudo extends DriveFolder {
  subpastas: DriveFolder[]
  arquivos: DriveFile[]
  expandida: boolean
  carregando: boolean
}

interface ArquivoAnalise {
  id: string
  nome: string
  tamanho: number
  slugCasa: string | null
}

interface DisparoAnalise {
  tipo: string
  arquivos: ArquivoAnalise[]
}

interface PastaAnalise {
  data: string
  id: string
  disparos: DisparoAnalise[]
  totalArquivos: number
}

interface ItemImportavel {
  data: string
  tipo: TipoDisparo
  slugCasas: string[]
  nomeCasas: string[]
  nomeArquivo: string
  driveFileId: string
  driveFolderId: string
  driveFolderPath: string
  selecionado: boolean
}

export default function BasesPage() {
  const [pastas, setPastas] = useState<PastaComConteudo[]>([])
  const [loading, setLoading] = useState(true)
  const [popularData, setPopularData] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const [criando, setCriando] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [novaData, setNovaData] = useState('')
  const [importModalAberto, setImportModalAberto] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [analiseDados, setAnaliseDados] = useState<PastaAnalise[]>([])
  const [itensImportaveis, setItensImportaveis] = useState<ItemImportavel[]>([])
  const [casas, setCasas] = useState<CasaAposta[]>([])
  const [importando, setImportando] = useState(false)
  const [novaPastaAvulsa, setNovaPastaAvulsa] = useState('')
  const [criandoAvulsa, setCriandoAvulsa] = useState(false)
  const [subpastaAberta, setSubpastaAberta] = useState<string | null>(null)
  const [subpastaNome, setSubpastaNome] = useState('')
  const [criandoSubpasta, setCriandoSubpasta] = useState<string | null>(null)
  const [uploadPastaId, setUploadPastaId] = useState<string | null>(null)
  const [uploadando, setUploadando] = useState(false)

  const carregarPastas = useCallback(async () => {
    try {
      setErro(null)
      const res = await fetch('/api/drive/pastas', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setPastas((json.pastas ?? []).map((p: DriveFolder) => ({
        ...p,
        subpastas: [],
        arquivos: [],
        expandida: false,
        carregando: false,
      })))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregarPastas() }, [carregarPastas])

  useEffect(() => {
    try {
      const state = getState()
      setCasas(Object.values(state.casasAposta ?? {}) as CasaAposta[])
    } catch { /* noop */ }
  }, [])

  async function expandirPasta(idx: number) {
    const pasta = pastas[idx]
    if (pasta.expandida) {
      setPastas((prev) => prev.map((p, i) => i === idx ? { ...p, expandida: false } : p))
      return
    }

    setPastas((prev) => prev.map((p, i) => i === idx ? { ...p, carregando: true, expandida: true } : p))

    try {
      const res = await fetch(`/api/drive/arquivos?folderId=${pasta.id}`)
      const json = await res.json()

      setPastas((prev) => prev.map((p, i) =>
        i === idx ? {
          ...p,
          subpastas: json.subpastas ?? [],
          arquivos: json.arquivos ?? [],
          carregando: false,
        } : p
      ))
    } catch {
      setPastas((prev) => prev.map((p, i) => i === idx ? { ...p, carregando: false } : p))
    }
  }

  async function expandirSubpasta(pastaIdx: number, subpasta: DriveFolder) {
    setPastas((prev) => prev.map((p, i) => {
      if (i !== pastaIdx) return p
      const subs = p.subpastas.map((s) => {
        if (s.id !== subpasta.id) return s
        const jaExpandida = 'expandida' in s && (s as PastaComConteudo['subpastas'][number] & { expandida?: boolean }).expandida
        return { ...s, expandida: !jaExpandida }
      })
      return { ...p, subpastas: subs }
    }))

    const res = await fetch(`/api/drive/arquivos?folderId=${subpasta.id}`)
    const json = await res.json()
    const arquivos: DriveFile[] = json.arquivos ?? []

    setPastas((prev) => prev.map((p, i) => {
      if (i !== pastaIdx) return p
      return {
        ...p,
        subpastas: p.subpastas.map((s) =>
          s.id === subpasta.id ? { ...s, arquivos } : s
        ),
      }
    }))
  }

  async function handlePopular(data: string) {
    setPopularData(data)
    setResultado(null)
    try {
      const res = await fetch('/api/drive/popular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const msgs = (json.resultados ?? []).map((r: { tipo: string; criados: number }) => `${r.tipo}: ${r.criados} arquivo(s)`).join(', ')
      setResultado(`Copiado: ${msgs}`)
      expandirPasta(pastas.findIndex((p) => p.nome === data))
    } catch (err) {
      setResultado(`Erro: ${(err as Error).message}`)
    } finally {
      setPopularData(null)
    }
  }

  async function handleCriarPasta() {
    if (!/^\d{4}$/.test(novaData)) return
    setCriando(novaData)
    setResultado(null)
    try {
      const res = await fetch('/api/drive/criar-pasta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novaData }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResultado(`Pasta ${novaData} criada com subpastas D1/D3/D5/D7`)
      setNovaData('')
      await carregarPastas()
    } catch (err) {
      setResultado(`Erro: ${(err as Error).message}`)
    } finally {
      setCriando('')
    }
  }

  async function handleCriarPastaAvulsa() {
    if (!novaPastaAvulsa.trim()) return
    setCriandoAvulsa(true)
    setResultado(null)
    try {
      const res = await fetch('/api/drive/criar-subpasta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novaPastaAvulsa.trim(), parentId: '' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResultado(`Pasta "${novaPastaAvulsa}" criada`)
      setNovaPastaAvulsa('')
      await carregarPastas()
    } catch (err) {
      setResultado(`Erro: ${(err as Error).message}`)
    } finally {
      setCriandoAvulsa(false)
    }
  }

  async function handleCriarSubpasta(parentId: string) {
    if (!subpastaNome.trim()) return
    setCriandoSubpasta(parentId)
    setResultado(null)
    try {
      const res = await fetch('/api/drive/criar-subpasta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: subpastaNome.trim(), parentId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResultado(`Subpasta "${subpastaNome}" criada`)
      setSubpastaNome('')
      setSubpastaAberta(null)
      // Recarregar pastas e re-expandir a pasta pai
      const pastaIdx = pastas.findIndex((p) => p.subpastas.some((s) => s.id === parentId) || p.id === parentId)
      await carregarPastas()
      if (pastaIdx >= 0) expandirPasta(pastaIdx)
    } catch (err) {
      setResultado(`Erro: ${(err as Error).message}`)
    } finally {
      setCriandoSubpasta(null)
    }
  }

  async function handleUpload(folderId: string) {
    const input = document.getElementById(`upload-${folderId}`) as HTMLInputElement
    if (!input?.files?.length) return
    setUploadPastaId(folderId)
    setUploadando(true)
    setResultado(null)
    try {
      const formData = new FormData()
      formData.append('pastaId', folderId)
      formData.append('arquivo', input.files[0])
      const res = await fetch('/api/drive/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResultado(`"${input.files[0].name}" enviado`)
      input.value = ''
      // Recarregar e re-expandir
      const pastaIdx = pastas.findIndex((p) =>
        p.id === folderId || p.subpastas.some((s) => s.id === folderId)
      )
      await carregarPastas()
      if (pastaIdx >= 0) expandirPasta(pastaIdx)
    } catch (err) {
      setResultado(`Erro: ${(err as Error).message}`)
    } finally {
      setUploadPastaId(null)
      setUploadando(false)
    }
  }

  async function handleAnalisar() {
    setAnalisando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/drive/analisar')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAnaliseDados(json.pastas)

      const slugsEncontrados: string[] = json.slugsEncontrados ?? []
      const itens: ItemImportavel[] = []
      for (const pasta of json.pastas as PastaAnalise[]) {
        for (const disp of pasta.disparos) {
          for (const arq of disp.arquivos) {
            const slug = arq.slugCasa ?? ''
            const casasMatch = casas.filter((c) =>
              slug !== '' && slug !== null && c.slug.toLowerCase().includes(slug.toLowerCase())
            )
            const nomeCasas = casasMatch.length > 0 ? casasMatch.map((c) => c.nome) : slug ? [slug] : []
            const slugCasas = casasMatch.length > 0 ? casasMatch.map((c) => c.id) : slug ? [slug] : []

            itens.push({
              data: pasta.data,
              tipo: disp.tipo as TipoDisparo,
              slugCasas,
              nomeCasas,
              nomeArquivo: arq.nome,
              driveFileId: arq.id,
              driveFolderId: pasta.id,
              driveFolderPath: `/${pasta.data}/${disp.tipo}`,
              selecionado: slugCasas.length > 0,
            })
          }
        }
      }
      setItensImportaveis(itens)
      setImportModalAberto(true)
    } catch (err) {
      setResultado(`Erro: ${(err as Error).message}`)
    } finally {
      setAnalisando(false)
    }
  }

  function toggleItem(idx: number) {
    setItensImportaveis((prev) => prev.map((item, i) => i === idx ? { ...item, selecionado: !item.selecionado } : item))
  }

  function toggleTodos(selecionar: boolean) {
    setItensImportaveis((prev) => prev.map((item) => ({ ...item, selecionado: selecionar })))
  }

  async function handleImportar() {
    const selecionados = itensImportaveis.filter((i) => i.selecionado)
    if (selecionados.length === 0) return

    setImportando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/disparos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selecionados.map(({ selecionado, nomeCasas, ...rest }) => ({
            ...rest,
            nomeCasas,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      // Merge with app store
      const state = getState()
      for (const dis of json.disparos ?? []) {
        state.disparos[dis.id] = dis
      }
      for (const est of json.esteiras ?? []) {
        state.esteiras[est.id] = est
      }
      setState(state)

      setResultado(`Importados ${json.disparos.length} disparos e ${json.esteiras.length} esteiras com sucesso`)
      setImportModalAberto(false)
      setAnaliseDados([])
      setItensImportaveis([])
    } catch (err) {
      setResultado(`Erro: ${(err as Error).message}`)
    } finally {
      setImportando(false)
    }
  }

  return (
    <>
      <PageHeader
        titulo="Bases"
        descricao="Gerenciador de arquivos no Google Drive"
        acoes={
          <div className="flex items-center gap-2">
            <button
              onClick={handleAnalisar}
              disabled={analisando}
              className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white bg-[var(--d3)] hover:brightness-110 disabled:opacity-50 transition-all"
            >
              <Upload size={14} className={analisando ? 'animate-spin' : ''} />
              {analisando ? 'Analisando...' : 'Importar retroativos'}
            </button>
            <button
              onClick={carregarPastas}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {erro && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
            <AlertTriangle size={14} />
            {erro}
          </div>
        )}

        {resultado && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${resultado.startsWith('Erro') ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}
            style={{
              backgroundColor: resultado.startsWith('Erro') ? 'var(--error)15' : 'var(--success)15',
              border: `1px solid ${resultado.startsWith('Erro') ? 'var(--error)30' : 'var(--success)30'}`,
            }}
          >
            {resultado.startsWith('Erro') ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
            {resultado}
          </div>
        )}

        {/* Pasta diária DDMM */}
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[200px]">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Pasta diária (DDMM)</label>
            <input
              value={novaData}
              onChange={(e) => setNovaData(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Ex: 2306"
              className="w-full px-3 h-8 rounded-md text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--d1)]"
            />
          </div>
          <button
            onClick={handleCriarPasta}
            disabled={criando !== '' || !/^\d{4}$/.test(novaData)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white bg-[var(--d1)] hover:brightness-110 disabled:opacity-50 transition-all"
          >
            <Plus size={14} />
            {criando ? 'Criando...' : 'Criar'}
          </button>
        </div>

        {/* Pasta avulsa */}
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[280px]">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Pasta avulsa</label>
            <input
              value={novaPastaAvulsa}
              onChange={(e) => setNovaPastaAvulsa(e.target.value)}
              placeholder="Ex: Campanha_ClienteX"
              className="w-full px-3 h-8 rounded-md text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--d3)]"
            />
          </div>
          <button
            onClick={handleCriarPastaAvulsa}
            disabled={criandoAvulsa || !novaPastaAvulsa.trim()}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white bg-[var(--d3)] hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {criandoAvulsa ? <Spinner size={14} /> : <Plus size={14} />}
            {criandoAvulsa ? 'Criando...' : 'Criar'}
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        )}

        {!loading && pastas.length === 0 && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Nenhuma pasta encontrada no Drive.
          </div>
        )}

        {!loading && pastas.length > 0 && (
          <div className="space-y-1">
            {pastas.map((pasta, idx) => (
              <div key={pasta.id} className="border border-[var(--border)] rounded-md bg-[var(--bg-surface)]">
                <button
                  onClick={() => expandirPasta(idx)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--bg-elevated)]/50 transition-colors"
                >
                  {pasta.carregando ? (
                    <Spinner size={14} />
                  ) : pasta.expandida ? (
                    <ChevronDown size={14} className="text-[var(--text-muted)]" />
                  ) : (
                    <ChevronRight size={14} className="text-[var(--text-muted)]" />
                  )}
                  <FolderOpen size={16} className="text-[var(--d1)]" />
                  <span className="font-medium text-[var(--text-primary)]">{pasta.nome}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-auto">
                    {pasta.subpastas.length} subpastas · {pasta.arquivos.length} CSVs
                  </span>
                </button>

                {pasta.expandida && (
                  <div className="px-4 pb-3 space-y-2 border-t border-[var(--border)] pt-2">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <button
                        onClick={() => { setSubpastaAberta(subpastaAberta === pasta.id ? null : pasta.id); setSubpastaNome('') }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Plus size={12} />
                        Nova subpasta
                      </button>
                      <label className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
                        <Upload size={12} />
                        {uploadPastaId === pasta.id && uploadando ? 'Enviando...' : 'Upload CSV'}
                        <input
                          id={`upload-${pasta.id}`}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          disabled={uploadPastaId === pasta.id}
                          onChange={() => handleUpload(pasta.id)}
                        />
                      </label>
                      <button
                        onClick={() => handlePopular(pasta.nome)}
                        disabled={popularData === pasta.nome}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
                      >
                        <Copy size={12} />
                        {popularData === pasta.nome ? 'Copiando...' : 'Copiar automático'}
                      </button>
                    </div>

                    {subpastaAberta === pasta.id && (
                      <div className="flex items-center gap-2 ml-2 mb-2">
                        <input
                          value={subpastaNome}
                          onChange={(e) => setSubpastaNome(e.target.value)}
                          placeholder="Nome da subpasta"
                          className="flex-1 px-2 h-7 rounded text-[11px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--d3)]"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCriarSubpasta(pasta.id) }}
                        />
                        <button
                          onClick={() => handleCriarSubpasta(pasta.id)}
                          disabled={criandoSubpasta === pasta.id || !subpastaNome.trim()}
                          className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-medium text-white bg-[var(--d3)] hover:brightness-110 disabled:opacity-50"
                        >
                          {criandoSubpasta === pasta.id ? <Spinner size={11} /> : <Plus size={11} />}
                          Criar
                        </button>
                      </div>
                    )}

                    {pasta.subpastas.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] py-2">Nenhuma subpasta</p>
                    )}

                    {pasta.subpastas.map((sub) => {
                      const subExpandida = (sub as any)?.expandida
                      const arquivos = (sub as any)?.arquivos ?? []
                      return (
                        <div key={sub.id} className="ml-4">
                          <button
                            onClick={() => expandirSubpasta(idx, sub)}
                            className="flex items-center gap-2 py-1 text-xs hover:text-[var(--text-primary)] transition-colors"
                          >
                            {subExpandida ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <FolderOpen size={13} className="text-[var(--d3)]" />
                            <span className="text-[var(--text-primary)]">{sub.nome}</span>
                            <span className="text-[var(--text-muted)]">({arquivos.length})</span>
                          </button>

                          {subExpandida && (
                            <div className="ml-6 space-y-1">
                              <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
                                <Upload size={10} />
                                {uploadPastaId === sub.id && uploadando ? 'Enviando...' : 'Upload CSV'}
                                <input
                                  id={`upload-${sub.id}`}
                                  type="file"
                                  accept=".csv"
                                  className="hidden"
                                  disabled={uploadPastaId === sub.id}
                                  onChange={() => handleUpload(sub.id)}
                                />
                              </label>
                              {arquivos.length === 0 && (
                                <p className="text-[11px] text-[var(--text-muted)] py-1">Nenhum CSV</p>
                              )}
                              {arquivos.map((arq: DriveFile) => (
                                <div key={arq.id} className="flex items-center gap-2 py-1 text-[11px]">
                                  <FileText size={12} className="text-[var(--text-muted)]" />
                                  <span className="text-[var(--text-primary)]">{arq.nome}</span>
                                  <span className="text-[var(--text-muted)]">({(arq.tamanho / 1024).toFixed(0)} KB)</span>
                                  <a
                                    href={`/api/drive/download?fileId=${arq.id}`}
                                    className="ml-auto text-[var(--d1)] hover:underline"
                                  >
                                    <Download size={12} />
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}


                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de importação */}
      {importModalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Importar disparos retroativos</h2>
              <button onClick={() => setImportModalAberto(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {itensImportaveis.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Nenhum arquivo encontrado para importar.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-[var(--text-muted)]">{itensImportaveis.length} arquivo(s) encontrados</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleTodos(true)} className="text-[11px] text-[var(--d1)] hover:underline">Selecionar todos</button>
                      <button onClick={() => toggleTodos(false)} className="text-[11px] text-[var(--text-muted)] hover:underline">Limpar</button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {itensImportaveis.map((item, idx) => (
                      <label
                        key={`${item.data}-${item.tipo}-${item.nomeArquivo}-${idx}`}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                          item.selecionado ? 'bg-[var(--d3)]10' : 'hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.selecionado}
                          onChange={() => toggleItem(idx)}
                          className="accent-[var(--d3)]"
                        />
                        <span className="w-10 font-mono text-[var(--d1)]">{item.data}</span>
                        <span className={`w-7 font-mono font-medium ${
                          item.tipo === 'D1' ? 'text-[var(--d1)]' :
                          item.tipo === 'D3' ? 'text-[var(--d3)]' :
                          item.tipo === 'D5' ? 'text-[var(--d5)]' :
                          'text-[var(--d7)]'
                        }`}>{item.tipo}</span>
                        <span className="flex-1 truncate text-[var(--text-primary)]">{item.nomeArquivo}</span>
                        <span className="text-[var(--text-muted)]">{item.nomeCasas.join(', ') || '-'}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
              <button
                onClick={() => setImportModalAberto(false)}
                className="px-3 h-8 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportar}
                disabled={importando || itensImportaveis.filter((i) => i.selecionado).length === 0}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white bg-[var(--d3)] hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {importando ? <Spinner size={14} /> : <Upload size={14} />}
                {importando
                  ? 'Importando...'
                  : `Importar ${itensImportaveis.filter((i) => i.selecionado).length} item(ns)`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
