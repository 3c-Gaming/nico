'use client'

import { useState } from 'react'
import { Bot, Send } from 'lucide-react'

interface NumeroAvatarProps {
  foto?: string | null
  nome?: string | null
  canal?: 'whatsapp' | 'telegram'
  className?: string
}

function iniciais(nome?: string | null): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  return partes.slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

/**
 * Avatar de um número/bot nos cards compactos da Home.
 * URLs vêm de provedores externos (SendPulse, Black Sender e Telegram), por isso
 * usa <img> com tamanho reservado e fallback local em vez de depender de domínios
 * configurados no next/image.
 */
export function NumeroAvatar({ foto, nome, canal = 'whatsapp', className = '' }: NumeroAvatarProps) {
  const [urlComErro, setUrlComErro] = useState<string | null>(null)
  const erro = urlComErro === foto
  const texto = iniciais(nome)

  const tamanho = 'w-9 h-9'
  const base = `${tamanho} rounded-full shrink-0 border border-[var(--border)] bg-[var(--bg-elevated)]`

  if (foto && !erro) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa variável por provedor
      <img
        src={foto}
        alt={nome ? `Foto de perfil de ${nome}` : 'Foto de perfil do número'}
        className={`${base} object-cover ${className}`}
        loading="lazy"
        onError={() => setUrlComErro(foto)}
      />
    )
  }

  return (
    <div
      className={`${base} flex items-center justify-center ${className}`}
      aria-label={nome ? `Foto de perfil de ${nome}` : 'Foto de perfil do número'}
      role="img"
    >
      {texto ? (
        <span className="text-[11px] font-bold font-mono text-[var(--text-primary)]/70">{texto}</span>
      ) : canal === 'telegram' ? (
        <Send size={15} className="text-[var(--text-primary)]/70" aria-hidden="true" />
      ) : (
        <Bot size={15} className="text-[var(--text-primary)]/70" aria-hidden="true" />
      )}
    </div>
  )
}
