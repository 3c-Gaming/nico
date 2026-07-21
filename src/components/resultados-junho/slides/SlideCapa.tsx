'use client'

import { motion } from 'framer-motion'
import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { itemVariants } from '../SlideShell'

const containerVariants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
}

interface SlideCapaProps {
  dados: ResultadosJunho2026
  titulo: string
  topicos?: TopicosResultado
}

export function SlideCapa({ dados, titulo, topicos }: SlideCapaProps) {
  const imagemFundo = topicos?.capaImagemFundo
  const logos = topicos?.logos ?? []
  const logoAltura = topicos?.logoAltura ?? 48

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${imagemFundo ? 'bg-cover bg-center' : 'gradiente-resultados'}`}
      style={
        imagemFundo
          ? { backgroundImage: `url(${imagemFundo})` }
          : { backgroundImage: 'linear-gradient(120deg, var(--d1), var(--d3), var(--d5), var(--d7))' }
      }
    >
      <div className="absolute inset-0 bg-[var(--bg-base)]/70" />
      <motion.div
        variants={containerVariants}
        initial="oculto"
        animate="visivel"
        className="relative z-10 flex flex-col items-center text-center gap-6 px-8"
      >
        {logos.length > 0 && (
          <motion.div variants={itemVariants} className="flex items-center justify-center gap-6">
            {logos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="w-auto object-contain" style={{ height: logoAltura }} />
            ))}
          </motion.div>
        )}
        <motion.div variants={itemVariants} className="text-sm font-semibold tracking-[0.3em] uppercase text-[var(--text-secondary)]">
          Pilhado · 3C Sports
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-bold text-[var(--text-primary)]">
          {topicos?.capaTituloPrincipal || 'Retrospectiva'}
        </motion.h1>
        <motion.h2
          variants={itemVariants}
          className="text-4xl md:text-6xl font-bold"
          style={
            topicos?.capaTituloCor
              ? { color: topicos.capaTituloCor }
              : {
                  backgroundImage: 'linear-gradient(90deg, var(--d1), var(--d3), var(--d5), var(--d7))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }
          }
        >
          {titulo}
        </motion.h2>
        <motion.p variants={itemVariants} className="text-base md:text-lg text-[var(--text-secondary)] max-w-lg">
          {topicos?.capaSubtitulo || `${dados.periodo.inicio} a ${dados.periodo.fim} · Disparos WhatsApp`}
        </motion.p>
        <motion.div variants={itemVariants} className="mt-8 text-xs text-[var(--text-muted)]">
          <motion.span
            className="inline-block"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            use → ou clique para começar
          </motion.span>
        </motion.div>
      </motion.div>
    </div>
  )
}
