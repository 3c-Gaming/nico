'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ModalNovoResultado } from '@/components/resultados-junho/ModalNovoResultado'
import { formatarMoeda } from '@/components/resultados-junho/formato'
import { Trophy, Plus, Presentation, Globe, Pencil } from 'lucide-react'
import type { Resultado } from '@/types'

export default function ResultadosPage() {
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/resultados')
      const data = await res.json()
      setResultados(data.resultados ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        titulo="Resultados"
        descricao="Apresentações mensais de retrospectiva de disparos"
        icon={<Trophy size={20} className="text-[var(--text-secondary)]" />}
        acoes={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setModalAberto(true)}>
            Novo Resultado
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Spinner /></div>
        ) : resultados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <p className="text-sm text-[var(--text-secondary)]">Nenhum resultado ainda.</p>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setModalAberto(true)}>
              Novo Resultado
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resultados.map((r) => (
              <div
                key={r.id}
                className="rounded-lg overflow-hidden glass bg-[var(--glass-bg)] border border-[var(--glass-border)] flex flex-col"
              >
                <div
                  className="relative h-40 w-full bg-cover bg-center flex items-end p-3"
                  style={{
                    backgroundImage: r.topicos?.capaImagemFundo
                      ? `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url(${r.topicos.capaImagemFundo})`
                      : 'linear-gradient(120deg, var(--d1), var(--d3), var(--d5), var(--d7))',
                  }}
                >
                  {r.publicToken && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-white backdrop-blur-sm">
                      <Globe size={10} /> Público
                    </span>
                  )}
                  <div>
                    <h2 className="text-sm font-semibold text-white drop-shadow">{r.titulo}</h2>
                    <p className="text-xs text-white/80 drop-shadow">{r.periodoInicio} a {r.periodoFim}</p>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[var(--text-muted)]">Investimento</div>
                      <div className="font-semibold text-[var(--text-primary)]">{formatarMoeda(r.dados.totais.custo)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Faturamento</div>
                      <div className="font-semibold text-[var(--text-primary)]">{formatarMoeda(r.dados.totais.faturamento)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Lucro</div>
                      <div className="font-semibold text-[var(--text-primary)]">{formatarMoeda(r.dados.totais.lucro)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">ROAS</div>
                      <div className="font-semibold text-[var(--text-primary)]">{r.dados.totais.roas.toFixed(2)}x</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--border)]">
                    <Link href={`/resultados/${r.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        Editar
                        <Pencil size={14} />
                      </Button>
                    </Link>
                    <Link href={`/resultados/${r.id}/apresentar`} className="flex justify-center items-center gap-1 flex-1" target="_blank">
                      <Button variant="secondary" size="sm" className="w-full">
                        Visualizar
                        <Presentation size={14} />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalNovoResultado
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onCriado={(r) => setResultados((prev) => [r, ...prev])}
      />
    </div>
  )
}
