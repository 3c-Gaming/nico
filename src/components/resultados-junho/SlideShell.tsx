'use client'

import { motion } from 'framer-motion'

const containerVariants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

export const itemVariants = {
  oculto: { opacity: 0, y: 24 },
  visivel: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
}

interface SlideShellProps {
  eyebrow?: string
  titulo: React.ReactNode
  subtitulo?: React.ReactNode
  children?: React.ReactNode
  align?: 'center' | 'left'
}

export function SlideShell({ eyebrow, titulo, subtitulo, children, align = 'center' }: SlideShellProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="oculto"
      animate="visivel"
      className={`w-full max-w-7xl mx-auto flex flex-col gap-5 sm:gap-8 px-4 py-10 sm:px-8 sm:py-16 md:px-16 ${align === 'center' ? 'items-center text-center' : 'items-start text-left'}`}
    >
      {eyebrow && (
        <motion.div
          variants={itemVariants}
          className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--d1)]"
        >
          {eyebrow}
        </motion.div>
      )}
      <motion.h1
        variants={itemVariants}
        className="text-4xl md:text-6xl font-bold text-[var(--text-primary)] leading-tight"
      >
        {titulo}
      </motion.h1>
      {subtitulo && (
        <motion.div variants={itemVariants} className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl">
          {subtitulo}
        </motion.div>
      )}
      {children}
    </motion.div>
  )
}

export function SlideItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}
