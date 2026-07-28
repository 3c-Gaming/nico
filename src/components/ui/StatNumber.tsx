'use client'

import { useEffect, useState } from 'react'
import { animate } from 'framer-motion'

interface StatNumberProps {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  delay?: number
  className?: string
  style?: React.CSSProperties
}

export function StatNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.4,
  delay = 0,
  className,
  style,
}: StatNumberProps) {
  const [exibido, setExibido] = useState(0)

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1] as const,
      onUpdate: (v) => setExibido(v),
    })
    return () => controls.stop()
  }, [value, duration, delay])

  const formatado = exibido.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={className} style={style}>
      {prefix}
      {formatado}
      {suffix}
    </span>
  )
}
