'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useEsteiras } from '@/hooks/useEsteiras'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useEtapaConfigs } from '@/hooks/useEtapaConfigs'
import { Chip } from '@/components/ui/Chip'
import { StatusDot } from '@/components/ui/StatusDot'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { formatarData, parsearDataISO } from '@/lib/datas'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Settings, ChevronDown, ChevronUp } from 'lucide-react'

const CORES_TIPO: Record<string, string> = {
  D1: 'var(--d1)',
  D3: 'var(--d3)',
  D5: 'var(--d5)',
  D7: 'var(--d7)',
}

const TIPO_CASA_PADRAO: Record<string, string> = {
  D1: 'superbet',
  D3: 'betmgm',
  D5: 'superbet',
  D7: '',
}

export default function EsteirasPage() {
  const { list: esteiras, update: updateEsteira } = useEsteiras()
  const { getById: getDisparo } = useDisparos()
  const { casas } = useCasasAposta()
  const { configs, setConfigs } = useEtapaConfigs()
  const router = useRouter()

  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [editandoTipos, setEditandoTipos] = useState<string[]>([])
  const [novoTipo, setNovoTipo] = useState('')
  const [novaCasaId, setNovaCasaId] = useState('')

  const casasOptions = useMemo(() =>
    Object.values(casas).map((c) => ({ value: c.id, label: c.nome })),
    [casas],
  )

  function handleAdicionarEtapa() {
    if (!novoTipo.trim() || !novaCasaId) return
    setEditandoTipos((prev) => [...prev, novoTipo.trim()])
    const novosConfigs = [
      ...configs,
      { tipo: novoTipo.trim(), casaId: novaCasaId, offsetDias: configs.length * 2 },
    ]
    setConfigs(novosConfigs)
    setNovoTipo('')
    setNovaCasaId('')
  }

  function handleRemoverEtapa(tipo: string) {
    const novosConfigs = configs.filter((c) => c.tipo !== tipo)
    setEditandoTipos((prev) => prev.filter((t) => t !== tipo))
    setConfigs(novosConfigs)
  }

  function handleAlterarCasaEtapa(tipo: string, casaId: string) {
    const novosConfigs = configs.map((c) =>
      c.tipo === tipo ? { ...c, casaId } : c,
    )
    setConfigs(novosConfigs)
  }

  return (
    <>
      <PageHeader
        titulo="Esteiras"
        descricao="Esteiras de disparo"
      />

      {/* Configuração de Etapas */}
      <div className="px-6 pt-4">
        <button
          onClick={() => setMostrarConfig(!mostrarConfig)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-3"
        >
          <Settings size={16} />
          Configurar Etapas
          {mostrarConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {mostrarConfig && (
          <div className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] rounded-md p-5 mb-6">
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Defina os tipos de disparo que cada esteira deve gerar automaticamente.
              D1 é sempre obrigatório. Adicione ou remova etapas livremente.
            </p>

            <div className="space-y-3 mb-4">
              {configs.map((cfg) => (
                <div key={cfg.tipo} className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border)]">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${CORES_TIPO[cfg.tipo] || 'var(--d1)'}20`, color: CORES_TIPO[cfg.tipo] || 'var(--d1)' }}
                  >
                    {cfg.tipo}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">Offset: +{cfg.offsetDias}d</span>
                  <div className="flex-1 max-w-[200px]">
                    <Select
                      value={cfg.casaId}
                      options={casasOptions}
                      onChange={(e) => handleAlterarCasaEtapa(cfg.tipo, e.target.value)}
                    />
                  </div>
                  {cfg.tipo !== 'D1' && (
                    <button
                      onClick={() => handleRemoverEtapa(cfg.tipo)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {configs.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Nenhuma etapa configurada. A configuração padrão será usada (D1→D3→D5→D7).
              </p>
            )}

            <div className="flex items-center gap-3 pt-3 border-t border-[var(--border)]">
              <input
                type="text"
                placeholder="Ex: D9"
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value)}
                className="w-20 px-2 py-1.5 rounded-md text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--d1)]"
              />
              <div className="flex-1 max-w-[200px]">
                <Select
                  value={novaCasaId}
                  options={[{ value: '', label: 'Selecione a casa...' }, ...casasOptions]}
                  onChange={(e) => setNovaCasaId(e.target.value)}
                  placeholder="Selecione a casa"
                />
              </div>
              <Button size="sm" icon={<Plus size={14} />} onClick={handleAdicionarEtapa} disabled={!novoTipo.trim() || !novaCasaId}>
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Esteiras */}
      <div className="p-6 grid gap-4 md:grid-cols-2">
        {esteiras.map((esteira) => {
          const d1 = getDisparo(esteira.disparos.d1)

          return (
            <div
              key={esteira.id}
              className="glass bg-[var(--glass-bg)] border-2 border-[var(--glass-border)] shadow-[var(--glass-shadow)] rounded-md p-5 hover:bg-[var(--glass-hover-bg)] hover:shadow-[var(--glass-hover-shadow)] transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {esteira.nome}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Criada em {formatarData(parsearDataISO(esteira.criadaEm), 'DD/MM/YYYY')}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    esteira.ativa ? 'text-[var(--success)] bg-[var(--success)]/10' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {esteira.ativa ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              {esteira.casasAposta.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {esteira.casasAposta.map((cId) => {
                    const c = casas[cId]
                    if (!c) return null
                    return <Chip key={cId} label={c.nome} cor={c.cor} size="sm" />
                  })}
                </div>
              )}

              <div className="flex items-center gap-0">
                {esteira.etapas.map((etapa, idx) => {
                  const disp = getDisparo(etapa.disparoId)
                  const corVar = CORES_TIPO[etapa.tipo] || 'var(--d1)'
                  return (
                    <div key={etapa.tipo} className="flex items-center flex-1">
                      {idx > 0 && <div className="flex-1 h-px bg-[var(--border-strong)]" />}
                      <div
                        className="flex flex-col items-center gap-1 cursor-pointer"
                        onClick={() => disp && router.push(`/disparos/${disp.id}`)}
                      >
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${corVar}20`, color: corVar }}
                        >
                          {etapa.tipo}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                          {disp ? formatarData(parsearDataISO(disp.dataDisparo), 'DD/MM') : '-'}
                        </span>
                        <StatusDot status={disp?.status ?? 'rascunho'} size={6} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {esteiras.length === 0 && (
          <div className="col-span-full text-center py-12 text-[var(--text-muted)] text-sm">
            Nenhuma esteira ativa no momento
          </div>
        )}
      </div>
    </>
  )
}
