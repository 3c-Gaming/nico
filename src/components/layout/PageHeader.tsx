'use client'

interface PageHeaderProps {
  titulo: string
  descricao?: string
  acoes?: React.ReactNode
}

export function PageHeader({ titulo, descricao, acoes }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{titulo}</h1>
        {descricao && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </div>
  )
}
