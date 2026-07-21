'use client'

import { motion } from 'framer-motion'
import type { ResultadosJunho2026, TopicosResultado } from '@/types'
import { itemVariants } from '../SlideShell'
import { formatarMoeda } from '../formato'

const containerVariants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
}

interface SlideFechamentoProps {
  dados: ResultadosJunho2026
  topicos?: TopicosResultado
}

export function SlideFechamento({ dados, topicos }: SlideFechamentoProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="oculto"
      animate="visivel"
      className="flex flex-col items-center text-center gap-6 px-8 py-16"
    >
      <motion.div variants={itemVariants} className="text-sm font-semibold tracking-[0.2em] uppercase text-[var(--d1)]">
        {topicos?.fechamentoTitulo || 'Fechando o período'}
      </motion.div>
      <motion.h1 variants={itemVariants} className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] max-w-3xl">
        {formatarMoeda(dados.totais.lucro)} de lucro, {dados.totais.roas.toFixed(2)}x de ROAS
      </motion.h1>
      <motion.p variants={itemVariants} className="text-base md:text-lg text-[var(--text-secondary)] max-w-xl">
        {topicos?.fechamentoMensagem || 'Obrigado ao time de disparos.'}
      </motion.p>
      <motion.div variants={itemVariants} className="text-xs text-[var(--text-muted)] tracking-widest uppercase mt-4">
        Pilhado · 3C Sports
      </motion.div>
    </motion.div>
  )
}
