'use client'

import { LIGAS_ACOMPANHADAS } from '@/lib/jogos'

interface JogosFiltrosProps {
  selecionadas: number[]
  onChange: (ids: number[]) => void
}

// CDN pública da API-Football pra escudo de liga — os ids em LIGAS_ACOMPANHADAS já seguem a
// numeração deles (ver footballData.ts), então dá pra montar a URL direto sem guardar nada extra.
// Sem autenticação, mesmo padrão de uso já visto noutros lugares do app pra imagem externa sem
// domínio fixo (ver LeadConversaCard.tsx).
function logoUrl(ligaId: number): string {
  return `https://media.api-sports.io/football/leagues/${ligaId}.png`
}

export function JogosFiltros({ selecionadas, onChange }: JogosFiltrosProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {LIGAS_ACOMPANHADAS.map((liga) => {
        const ativo = selecionadas.includes(liga.id)
        return (
          <button
            key={liga.id}
            onClick={() => onChange(ativo ? selecionadas.filter((id) => id !== liga.id) : [...selecionadas, liga.id])}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors whitespace-nowrap cursor-pointer ${
              ativo
                ? 'bg-[var(--d1)] text-white border-[var(--d1)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- CDN externa (API-Football), sem domínio fixo pra configurar no next/image */}
            <img src={logoUrl(liga.id)} alt="" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" />
            {liga.nome}
          </button>
        )
      })}
    </div>
  )
}
