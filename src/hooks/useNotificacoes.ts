'use client'

import { useCallback, useEffect, useState } from 'react'
import type { StatusPlanoSendpulse } from '@/lib/integrações/sendpulse'
import { classificarPlanosSendpulse } from '@/lib/sendpulsePlanos'
import { diasAte } from '@/lib/datas'

export interface Notificacao {
  id: string
  nivel: 'erro' | 'aviso'
  titulo: string
  texto: string
}

const LS_KEY = 'nico_notif_dispensadas'
const EVT = 'nico:notif-changed'

function lerDispensadas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]') as string[])
  } catch {
    return new Set()
  }
}

function salvarDispensadas(s: Set<string>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...s])) } catch { /* modo privado */ }
  window.dispatchEvent(new CustomEvent(EVT))
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

// Cache de módulo — o hook é usado em dois lugares (faixa do topo + botão da sidebar) e sem isso
// cada montagem bate na API. 60s é suficiente pra não recarregar a cada navegação.
let planosCache: { at: number; data: StatusPlanoSendpulse[] } | null = null
let planosInflight: Promise<StatusPlanoSendpulse[]> | null = null

async function buscarPlanos(): Promise<StatusPlanoSendpulse[]> {
  if (planosCache && Date.now() - planosCache.at < 60_000) return planosCache.data
  if (planosInflight) return planosInflight
  planosInflight = fetch('/api/sendpulse/planos')
    .then((r) => (r.ok ? r.json() : { planos: [] }))
    .then((j) => {
      const d = (j.planos ?? []) as StatusPlanoSendpulse[]
      planosCache = { at: Date.now(), data: d }
      return d
    })
    .catch(() => [] as StatusPlanoSendpulse[])
    .finally(() => { planosInflight = null })
  return planosInflight
}

function montar(planos: StatusPlanoSendpulse[]): Notificacao[] {
  const { expirados, expirando } = classificarPlanosSendpulse(planos)
  const out: Notificacao[] = []
  for (const p of expirados) {
    out.push({
      id: `sp-plano-erro-${p.contaId}-${p.expiredAt ?? '0'}`,
      nivel: 'erro',
      titulo: 'Plano da SendPulse expirado',
      texto: `${p.contaNome}${p.tariffCode ? ` (${p.tariffCode})` : ''} expirou em ${p.expiredAt ? fmt(p.expiredAt) : '—'}.`,
    })
  }
  for (const p of expirando) {
    out.push({
      id: `sp-plano-aviso-${p.contaId}-${p.expiredAt ?? '0'}`,
      nivel: 'aviso',
      titulo: 'Plano da SendPulse expirando',
      texto: `${p.contaNome}${p.tariffCode ? ` (${p.tariffCode})` : ''} expira em ${diasAte(p.expiredAt!)} dia(s) (${fmt(p.expiredAt!)}).`,
    })
  }
  return out
}

export function useNotificacoes() {
  const [todas, setTodas] = useState<Notificacao[]>([])
  const [dispensadas, setDispensadas] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancel = false
    buscarPlanos().then((planos) => { if (!cancel) setTodas(montar(planos)) })
    return () => { cancel = true }
  }, [])

  useEffect(() => {
    const sync = () => setDispensadas(lerDispensadas())
    sync()
    window.addEventListener(EVT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const dispensar = useCallback((id: string) => {
    const s = lerDispensadas()
    s.add(id)
    salvarDispensadas(s)
  }, [])

  const restaurar = useCallback((id: string) => {
    const s = lerDispensadas()
    s.delete(id)
    salvarDispensadas(s)
  }, [])

  const dispensarTodas = useCallback(() => {
    const s = lerDispensadas()
    for (const n of todas) s.add(n.id)
    salvarDispensadas(s)
  }, [todas])

  const ativas = todas.filter((n) => !dispensadas.has(n.id))

  return { todas, ativas, dispensadas, naoLidas: ativas.length, dispensar, restaurar, dispensarTodas }
}
