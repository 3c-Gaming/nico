import type { StatusPlanoSendpulse } from './integrações/sendpulse'
import { diasAte } from './datas'

// Limiar (dias) pra considerar um plano "expirando em breve" — usado tanto no banner da web
// quanto no alerta do Discord, pra manter os dois critérios sempre iguais. Módulo separado
// (em vez de dentro de integrações/sendpulse.ts) porque esse aqui precisa ser seguro de
// importar num client component — só usa `import type` da sendpulse.ts, sem trazer código
// server-only (fetch/env) pro bundle do navegador.
export const LIMIAR_DIAS_ALERTA_PLANO = 5

export function classificarPlanosSendpulse(planos: StatusPlanoSendpulse[]) {
  const expirados = planos.filter((p) => p.isExpired)
  const expirando = planos.filter(
    (p) => !p.isExpired && p.expiredAt && diasAte(p.expiredAt) <= LIMIAR_DIAS_ALERTA_PLANO,
  )
  return { expirados, expirando }
}
