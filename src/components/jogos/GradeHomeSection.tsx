'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LandPlot, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Jogo } from '@/types'
import { CardJogo } from './CardJogo'
import { Spinner } from '@/components/ui/Spinner'
import { hojeBrasilISO, dataParaBrasilISO } from '@/lib/datas'

function proximoDiaISO(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10)
}

interface ItemCarrossel {
  jogo: Jogo
  rotuloDia?: string // marca só o primeiro item de cada dia, pra separar "Hoje" de "Amanhã" na fita
}

/** Jogos de hoje e amanhã na Home, num carrossel horizontal — hoje primeiro, amanhã em seguida na
 * mesma fita (uma linha só, sem dividir em colunas por dia). Recorte rápido das 5 competições
 * cobertas (ver @/lib/integrações/footballData); a tela cheia de Jogos (/jogos), com filtros e
 * busca, continua sendo o lugar certo pra ver a semana inteira. */
export function GradeHomeSection() {
  const [jogos, setJogos] = useState<Jogo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const trilhaRef = useRef<HTMLDivElement>(null)

  const hoje = hojeBrasilISO()
  const amanha = proximoDiaISO(hoje)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        // dateFrom/dateTo da API são em UTC, e dateTo exclui o dia inteiro dele mesmo (confirmado
        // ao vivo: dateTo=X não traz nenhum jogo de X, só de antes) — um jogo de amanhã às 21h+ em
        // Brasília (UTC-3) já é UTC do dia seguinte, e pra esse dia entrar no resultado dateTo
        // precisa ser 2 dias depois de "amanhã", não 1. O filtro por dataParaBrasilISO abaixo
        // descarta o que sobrar fora de hoje/amanhã.
        const dateTo = proximoDiaISO(proximoDiaISO(amanha))
        const res = await fetch(`/api/jogos/fixtures?dateFrom=${hoje}&dateTo=${dateTo}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erro ao buscar jogos')
        if (cancelado) return
        setJogos(json.jogos ?? [])
      } catch (err) {
        if (!cancelado) setErro((err as Error).message)
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hoje/amanha só mudam virando o dia, não precisam disparar reload
  }, [])

  const ordenarPorHorario = (a: Jogo, b: Jogo) => a.date.localeCompare(b.date)
  const jogosHoje = jogos.filter((j) => dataParaBrasilISO(j.date) === hoje).sort(ordenarPorHorario)
  const jogosAmanha = jogos.filter((j) => dataParaBrasilISO(j.date) === amanha).sort(ordenarPorHorario)

  const itens: ItemCarrossel[] = [
    ...jogosHoje.map((jogo, i) => ({ jogo, rotuloDia: i === 0 ? 'Hoje' : undefined })),
    ...jogosAmanha.map((jogo, i) => ({ jogo, rotuloDia: i === 0 ? 'Amanhã' : undefined })),
  ]

  function rolar(direcao: 1 | -1) {
    trilhaRef.current?.scrollBy({ left: direcao * 300, behavior: 'smooth' })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <LandPlot size={16} className="text-[var(--d1)]" />
          Grade
        </h2>
        <div className="flex items-center gap-3">
          <Link href="/jogos" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Ver semana inteira →
          </Link>
          {itens.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => rolar(-1)}
                className="p-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label="Rolar pra esquerda"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => rolar(1)}
                className="p-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label="Rolar pra direita"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs mb-3" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
          <AlertTriangle size={14} />
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-10">
          <Spinner size={20} />
        </div>
      ) : itens.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-10">Sem jogos hoje ou amanhã</p>
      ) : (
        <div ref={trilhaRef} className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory">
          {itens.map(({ jogo, rotuloDia }) => (
            <div key={jogo.id} className="shrink-0 w-[220px] snap-start">
              <div className="h-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--d1)]">
                {rotuloDia}
              </div>
              <CardJogo jogo={jogo} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
