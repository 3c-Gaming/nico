'use client'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs text-[var(--text-secondary)] font-medium">{label}</label>
      )}
      <input
        className={`h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-[var(--error)]">{error}</span>}
    </div>
  )
}
