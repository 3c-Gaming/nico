import { ExternalLink, CornerUpLeft } from 'lucide-react'
import type { RcsSuggestion } from '@/lib/rcs/tipos'

/** Chips de sugestão do RCS no estilo do Google Messages: pílula com contorno fino, texto
 * em accent e ícone à esquerda (link = abrir, reply = responder). Só visual — no preview
 * não são clicáveis. */
export function RcsSuggestionChips({ suggestions }: { suggestions?: RcsSuggestion[] }) {
  if (!suggestions?.length) return null
  return (
    <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1.5">
      {suggestions.map((s, i) => (
        <span
          key={i}
          title={s.type === 'OPEN_URL' ? s.url : `postback: ${s.postbackData}`}
          className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-sky-400/35 bg-sky-400/[0.07] px-3.5 py-1.5 text-[12.5px] font-medium leading-none text-sky-300"
        >
          {s.type === 'OPEN_URL'
            ? <ExternalLink size={12} className="shrink-0 opacity-80" />
            : <CornerUpLeft size={12} className="shrink-0 opacity-80" />}
          <span className="truncate">{s.text || <span className="text-sky-300/50">botão sem texto</span>}</span>
        </span>
      ))}
    </div>
  )
}
