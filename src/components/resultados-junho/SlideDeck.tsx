'use client'

import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface SlideDefinicao {
  id: string
  render: () => React.ReactNode
}

interface SlideDeckProps {
  slides: SlideDefinicao[]
}

const variantes = {
  entra: (direcao: number) => ({ opacity: 0, x: direcao >= 0 ? 60 : -60 }),
  centro: { opacity: 1, x: 0 },
  sai: (direcao: number) => ({ opacity: 0, x: direcao >= 0 ? -60 : 60 }),
}

export function SlideDeck({ slides }: SlideDeckProps) {
  const [[indice, direcao], setEstado] = useState<[number, number]>([0, 0])
  const total = slides.length

  const irPara = useCallback(
    (novoIndice: number) => {
      setEstado(([atual]) => {
        const alvo = Math.max(0, Math.min(total - 1, novoIndice))
        if (alvo === atual) return [atual, 0]
        return [alvo, alvo > atual ? 1 : -1]
      })
    },
    [total],
  )

  const proximo = useCallback(() => irPara(indice + 1), [indice, irPara])
  const anterior = useCallback(() => irPara(indice - 1), [indice, irPara])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        proximo()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        anterior()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [proximo, anterior])

  return (
    <div className="relative w-full h-full min-h-[640px] overflow-hidden bg-[var(--bg-base)]">
      <AnimatePresence mode="wait" custom={direcao} initial={false}>
        <motion.div
          key={slides[indice].id}
          custom={direcao}
          variants={variantes}
          initial="entra"
          animate="centro"
          exit="sai"
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {slides[indice].render()}
        </motion.div>
      </AnimatePresence>

      <button
        onClick={anterior}
        disabled={indice === 0}
        aria-label="Slide anterior"
        className="absolute left-0 top-0 h-full w-1/7 flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity disabled:pointer-events-none z-10"
      >
        <ChevronLeft size={32} className="text-[var(--text-primary)] drop-shadow" />
      </button>
      <button
        onClick={proximo}
        disabled={indice === total - 1}
        aria-label="Próximo slide"
        className="absolute right-0 top-0 h-full w-1/7 flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity disabled:pointer-events-none z-10"
      >
        <ChevronRight size={32} className="text-[var(--text-primary)] drop-shadow" />
      </button>

      <div className="absolute top-6 right-6 text-xs font-mono text-[var(--text-muted)] z-10">
        {indice + 1} / {total}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => irPara(i)}
            aria-label={`Ir para slide ${i + 1}`}
            className="h-2.5 rounded transition-all duration-300 cursor-pointer"
            style={{
              width: i === indice ? 24 : 8,
              backgroundColor: i === indice ? 'var(--d1)' : 'var(--border-strong)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
