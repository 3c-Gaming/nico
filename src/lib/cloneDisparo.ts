import type { Disparo } from '@/types'

export function clonarDisparo(original: Disparo): Disparo {
  const agora = new Date().toISOString()

  const clone: Disparo = {
    id: crypto.randomUUID(),
    tipo: original.tipo,
    nomenclatura: `${original.nomenclatura} (cópia)`,
    status: 'rascunho',
    casasAposta: [...original.casasAposta],
    dataDisparo: original.dataDisparo,
    horarioDisparo: original.horarioDisparo,
    base: { ...original.base },
    templateDaxx: original.templateDaxx ? { ...original.templateDaxx } : undefined,
    numerosSendpulse: original.numerosSendpulse?.map((n) => ({ ...n })),
    flowIds: [...(original.flowIds ?? (original.flowId ? [original.flowId] : []))],
    linkTemplatesSelecionados: original.linkTemplatesSelecionados
      ? [...original.linkTemplatesSelecionados]
      : undefined,
    notas: original.notas,
    cpaPainelId: original.cpaPainelId,
    utm: original.utm,
    betmgmPid: original.betmgmPid,
    criadoEm: agora,
    atualizadoEm: agora,
  }

  return clone
}

export async function salvarCloneRemoto(disparo: Disparo): Promise<void> {
  await fetch('/api/disparos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disparo }),
  })
}
