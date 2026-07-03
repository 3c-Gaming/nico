'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { useEsteiras } from '@/hooks/useEsteiras'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { Chip } from '@/components/ui/Chip'
import { StatusDot } from '@/components/ui/StatusDot'
import { formatarData, parsearDataISO } from '@/lib/datas'
import { useRouter } from 'next/navigation'

export default function EsteirasPage() {
  const { list: esteiras } = useEsteiras()
  const { getById: getDisparo } = useDisparos()
  const { casas } = useCasasAposta()
  const router = useRouter()

  return (
    <>
      <PageHeader
        titulo="Esteiras"
        descricao="Esteiras de disparo ativas"
      />
      <div className="p-6 grid gap-4 md:grid-cols-2">
        {esteiras.map((esteira) => {
          const d1 = getDisparo(esteira.disparos.d1)
          const d3 = esteira.disparos.d3 ? getDisparo(esteira.disparos.d3) : null
          const d5 = esteira.disparos.d5 ? getDisparo(esteira.disparos.d5) : null
          const d7 = esteira.disparos.d7 ? getDisparo(esteira.disparos.d7) : null
          const filhos = [d3, d5, d7].filter(Boolean)

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
                <div
                  className="flex flex-col items-center gap-1 cursor-pointer"
                  onClick={() => d1 && router.push(`/disparos/${d1.id}`)}
                >
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--d1)20', color: 'var(--d1)' }}
                  >
                    D1
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                    {d1 ? formatarData(parsearDataISO(d1.dataDisparo), 'DD/MM') : '-'}
                  </span>
                  <StatusDot status={d1?.status ?? 'rascunho'} size={6} />
                </div>

                {filhos.map((filho, i) => {
                  const tipo = i === 0 ? 'D3' : i === 1 ? 'D5' : 'D7'
                  const corVar = tipo === 'D3' ? 'var(--d3)' : tipo === 'D5' ? 'var(--d5)' : 'var(--d7)'
                  return (
                    <div key={tipo} className="flex items-center flex-1">
                      <div className="flex-1 h-px bg-[var(--border-strong)]" />
                      <div
                        className="flex flex-col items-center gap-1 cursor-pointer"
                        onClick={() => filho && router.push(`/disparos/${filho.id}`)}
                      >
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${corVar}20`, color: corVar }}
                        >
                          {tipo}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                          {filho ? formatarData(parsearDataISO(filho.dataDisparo), 'DD/MM') : '-'}
                        </span>
                        <StatusDot status={filho?.status ?? 'rascunho'} size={6} />
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
